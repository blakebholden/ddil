"""CCS edge-federation router (adventure 4).

The querying cluster is Elastic Cloud Hosted (ECH, stateful). This box is added
to it as a remote cluster; "Synchronise Now" registers that remote over the
uplink, after which a cross-cluster search on ECH spans both the cloud's own
indices and the box's (`edge:field-reports`). All calls here target the ECH
endpoint — the box orchestrates the cloud cluster.

Endpoints
---------
GET  /api/ccs/status        is the edge remote connected? (_remote/info)
POST /api/ccs/synchronise   register the box as a remote cluster on ECH
POST /api/ccs/disconnect    remove the edge remote
GET  /api/ccs/search        federated search; scope=local|federated
GET  /api/ccs/state         what's wired (UI config card)
"""

from __future__ import annotations

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.config import settings
from app.services.embedder import embed_text

router = APIRouter()


def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if settings.ECH_API_KEY:
        h["Authorization"] = f"ApiKey {settings.ECH_API_KEY}"
    return h


async def _ech(method: str, path: str, json: dict | None = None) -> httpx.Response:
    url = f"{settings.ECH_ES_URL}{path}"
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.request(method, url, json=json, headers=_headers())
    return r


def _edge_auth() -> tuple[str, str] | None:
    if settings.ES_USER and settings.ES_PASSWORD:
        return (settings.ES_USER, settings.ES_PASSWORD)
    return None


async def _edge(method: str, path: str, json: dict | None = None) -> httpx.Response:
    """Call the box's LOCAL ES (where collected/embedded edge docs live)."""
    url = f"{settings.ccs_edge_es_url}{path}"
    async with httpx.AsyncClient(timeout=30, auth=_edge_auth()) as c:
        r = await c.request(method, url, json=json, headers={"Content-Type": "application/json"})
    return r


_EDGE_MAPPING = {
    "mappings": {
        "properties": {
            "title": {"type": "text"},
            "text": {"type": "text"},
            "origin": {"type": "keyword"},
            "region": {"type": "keyword"},
            "classification": {"type": "keyword"},
            "ts": {"type": "date"},
            "embedding": {
                "type": "dense_vector", "dims": settings.CCS_EMBED_DIMS,
                "index": True, "similarity": "cosine",
            },
        }
    }
}


async def _ensure_edge_index() -> None:
    r = await _edge("HEAD", f"/{settings.CCS_INDEX}")
    if r.status_code == 404:
        await _edge("PUT", f"/{settings.CCS_INDEX}", _EDGE_MAPPING)


@router.get("/state")
async def state():
    return {
        "coordinator": settings.ccs_edge_es_url,   # the box runs the CCS
        "cloud_alias": settings.CCS_CLOUD_ALIAS,
        "cloud_proxy": settings.CCS_CLOUD_PROXY,
        "ech_url": settings.ECH_ES_URL,
        "index": settings.CCS_INDEX,
    }


@router.get("/status")
async def status():
    """Is the ECH 'cloud' remote registered + connected on the box?"""
    r = await _edge("GET", "/_remote/info")
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    cloud = r.json().get(settings.CCS_CLOUD_ALIAS)
    return {
        "connected": bool(cloud and cloud.get("connected")),
        "registered": bool(cloud),
        "alias": settings.CCS_CLOUD_ALIAS,
        "detail": cloud or {},
    }


@router.post("/synchronise")
async def synchronise():
    """'Synchronise Now': the box registers ECH as remote cluster 'cloud' (proxy
    mode, outbound). The cross-cluster API key is pre-loaded in the box keystore;
    this just sets mode + proxy_address to bring the link up."""
    alias = settings.CCS_CLOUD_ALIAS
    persistent: dict = {
        f"cluster.remote.{alias}.mode": "proxy",
        f"cluster.remote.{alias}.proxy_address": settings.CCS_CLOUD_PROXY,
        f"cluster.remote.{alias}.skip_unavailable": True,
    }
    if settings.CCS_CLOUD_SERVER_NAME:
        persistent[f"cluster.remote.{alias}.server_name"] = settings.CCS_CLOUD_SERVER_NAME
    r = await _edge("PUT", "/_cluster/settings", {"persistent": persistent})
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    info = await _edge("GET", "/_remote/info")
    cloud = info.json().get(alias, {}) if info.status_code < 400 else {}
    return {"ok": True, "connected": bool(cloud.get("connected")), "detail": cloud}


@router.post("/disconnect")
async def disconnect():
    alias = settings.CCS_CLOUD_ALIAS
    persistent = {
        f"cluster.remote.{alias}.mode": None,
        f"cluster.remote.{alias}.proxy_address": None,
        f"cluster.remote.{alias}.server_name": None,
        f"cluster.remote.{alias}.skip_unavailable": None,
    }
    r = await _edge("PUT", "/_cluster/settings", {"persistent": persistent})
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return {"ok": True}


@router.get("/search")
async def search(
    q: str = Query("", description="query string; empty = match_all"),
    scope: str = Query("federated", pattern="^(local|federated)$"),
    size: int = Query(20, ge=1, le=100),
):
    """Run the search ON THE BOX (the coordinator). scope=local hits only the
    box's edge index; scope=federated also spans the ECH remote
    (cloud:field-reports), so the count jumps cloud-in when 'cloud' is connected."""
    idx = settings.CCS_INDEX
    alias = settings.CCS_CLOUD_ALIAS

    # Only span the cloud remote when it's registered — otherwise ES raises
    # no_such_remote_cluster. UI can always ask "federated" and get edge-only
    # until Synchronise Now connects ECH.
    cloud_registered = False
    if scope == "federated":
        info = await _edge("GET", "/_remote/info")
        cloud_registered = info.status_code < 400 and alias in info.json()
    target = f"{idx},{alias}:{idx}" if cloud_registered else idx

    query = {"match": {"text": q}} if q.strip() else {"match_all": {}}
    body = {"size": size, "query": query, "_source": True}

    r = await _edge("GET", f"/{target}/_search?ccs_minimize_roundtrips=true", body)
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    res = r.json()

    cloud, edge = 0, 0
    hits = []
    for h in res.get("hits", {}).get("hits", []):
        index = h.get("_index", "")
        # remote (ECH) hits carry the alias prefix, e.g. "cloud:field-reports"
        from_cloud = index.startswith(f"{alias}:")
        cloud += from_cloud
        edge += not from_cloud
        s = h.get("_source", {})
        hits.append({
            "id": h.get("_id"),
            "cluster": "cloud" if from_cloud else "edge",
            "score": h.get("_score"),
            "title": s.get("title") or s.get("name"),
            "text": s.get("text") or s.get("summary") or "",
            "source": s,
        })

    clusters = res.get("_clusters", {})
    return {
        "scope": scope,
        "cloud_registered": cloud_registered,
        "took_ms": res.get("took"),
        "total": res.get("hits", {}).get("total", {}).get("value", 0),
        "counts": {"cloud": cloud, "edge": edge},
        "clusters": {
            "total": clusters.get("total"),
            "successful": clusters.get("successful"),
            "skipped": clusters.get("skipped"),
        },
        "hits": hits,
    }


# ─────────────── edge collection (iPad scene) ────────────────────────────────
class FieldReport(BaseModel):
    title: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)
    region: str | None = None
    classification: str | None = None


@router.post("/collect")
async def collect(report: FieldReport):
    """Collect + embed a field report ON THE BOX, writing it to the local edge
    index that HQ federates into. This is the iPad/edge half of the demo: data
    is generated at the edge and vectorised on the Spark, disconnected."""
    await _ensure_edge_index()
    try:
        vec = await embed_text(report.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"edge embed failed: {e}")

    doc = {
        "title": report.title,
        "text": report.text,
        "origin": "edge",
        "region": report.region or "FIELD",
        "classification": report.classification or "U",
        "ts": datetime.now(timezone.utc).isoformat(),
        "embedding": vec,
    }
    r = await _edge("POST", f"/{settings.CCS_INDEX}/_doc?refresh=true", doc)
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text)

    cnt = await _edge("GET", f"/{settings.CCS_INDEX}/_count")
    count = cnt.json().get("count", 0) if cnt.status_code < 400 else None
    return {
        "indexed": True,
        "id": r.json().get("_id"),
        "embed_dims": len(vec),
        "edge_count": count,
        "doc": {k: doc[k] for k in ("title", "region", "classification", "ts")},
    }


@router.get("/edge/stats")
async def edge_stats():
    """Running totals for the edge collection scene."""
    body = {"size": 0, "track_total_hits": True, "aggs": {
        "regions": {"terms": {"field": "region", "size": 10}},
        "classification": {"terms": {"field": "classification", "size": 6}},
    }}
    r = await _edge("POST", f"/{settings.CCS_INDEX}/_search", body)
    if r.status_code == 404:
        return {"count": 0, "regions": [], "classification": [], "embed_dims": settings.CCS_EMBED_DIMS}
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    res = r.json()
    aggs = res.get("aggregations", {})
    buckets = lambda n: [{"key": b["key"], "count": b["doc_count"]} for b in aggs.get(n, {}).get("buckets", [])]
    return {
        "count": res.get("hits", {}).get("total", {}).get("value", 0),
        "regions": buckets("regions"),
        "classification": buckets("classification"),
        "embed_dims": settings.CCS_EMBED_DIMS,
    }
