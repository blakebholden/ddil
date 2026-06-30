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
        "ech_url": settings.ECH_ES_URL,
        "alias": settings.CCS_REMOTE_ALIAS,
        "box_proxy": settings.CCS_BOX_PROXY,
        "mode": settings.CCS_BOX_MODE,
        "index": settings.CCS_INDEX,
    }


@router.get("/status")
async def status():
    """Report whether the edge remote is registered + connected on ECH."""
    r = await _ech("GET", "/_remote/info")
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    info = r.json()
    edge = info.get(settings.CCS_REMOTE_ALIAS)
    return {
        "connected": bool(edge and edge.get("connected")),
        "registered": bool(edge),
        "alias": settings.CCS_REMOTE_ALIAS,
        "detail": edge or {},
    }


@router.post("/synchronise")
async def synchronise():
    """The 'Synchronise Now' action: register the box as a remote cluster on ECH
    (proxy mode over the uplink), then report the connection."""
    body = {
        "persistent": {
            f"cluster.remote.{settings.CCS_REMOTE_ALIAS}.mode": settings.CCS_BOX_MODE,
            f"cluster.remote.{settings.CCS_REMOTE_ALIAS}.proxy_address": settings.CCS_BOX_PROXY,
            f"cluster.remote.{settings.CCS_REMOTE_ALIAS}.skip_unavailable": True,
        }
    }
    r = await _ech("PUT", "/_cluster/settings", body)
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    info = await _ech("GET", "/_remote/info")
    edge = info.json().get(settings.CCS_REMOTE_ALIAS, {}) if info.status_code < 400 else {}
    return {"ok": True, "connected": bool(edge.get("connected")), "detail": edge}


@router.post("/disconnect")
async def disconnect():
    body = {
        "persistent": {
            f"cluster.remote.{settings.CCS_REMOTE_ALIAS}.mode": None,
            f"cluster.remote.{settings.CCS_REMOTE_ALIAS}.proxy_address": None,
            f"cluster.remote.{settings.CCS_REMOTE_ALIAS}.skip_unavailable": None,
        }
    }
    r = await _ech("PUT", "/_cluster/settings", body)
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return {"ok": True}


@router.get("/search")
async def search(
    q: str = Query("", description="query string; empty = match_all"),
    scope: str = Query("federated", pattern="^(local|federated)$"),
    size: int = Query(20, ge=1, le=100),
):
    """Run the search on ECH. scope=local hits only the cloud's own index;
    scope=federated also spans the edge remote (edge:field-reports), so the
    result count jumps when the box is online."""
    idx = settings.CCS_INDEX
    alias = settings.CCS_REMOTE_ALIAS

    # Only span the edge remote when it's actually registered — otherwise ES
    # raises no_such_remote_cluster. This lets the UI always ask for "federated"
    # and naturally get cloud-only until "Synchronise Now" registers the box.
    edge_registered = False
    if scope == "federated":
        info = await _ech("GET", "/_remote/info")
        edge_registered = info.status_code < 400 and alias in info.json()
    target = f"{idx},{alias}:{idx}" if edge_registered else idx

    query = {"match": {"text": q}} if q.strip() else {"match_all": {}}
    body = {"size": size, "query": query, "_source": True}

    r = await _ech("GET", f"/{target}/_search?ccs_minimize_roundtrips=true", body)
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    res = r.json()

    cloud, edge = 0, 0
    hits = []
    for h in res.get("hits", {}).get("hits", []):
        index = h.get("_index", "")
        # remote hits carry the cluster alias prefix, e.g. "edge:field-reports"
        from_edge = index.startswith(f"{alias}:")
        edge += from_edge
        cloud += not from_edge
        s = h.get("_source", {})
        hits.append({
            "id": h.get("_id"),
            "cluster": "edge" if from_edge else "cloud",
            "score": h.get("_score"),
            "title": s.get("title") or s.get("name"),
            "text": s.get("text") or s.get("summary") or "",
            "source": s,
        })

    clusters = res.get("_clusters", {})
    return {
        "scope": scope,
        "edge_registered": edge_registered,
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
