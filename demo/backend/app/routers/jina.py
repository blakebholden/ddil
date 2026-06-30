"""Jina multimodal + DLS "Need-to-Know" router (adventure 3).

Endpoints
---------
GET /api/jina/analysts                list the 4 clearance personas
GET /api/jina/multimodal/search       "search images by typing words" — ES-native
                                       inference kNN over jina-multimodal (768-d)
GET /api/jina/search                  DLS hybrid (BM25+kNN RRF) over pmc-unstructured
                                       (1024-d), pre-filtered by analyst clearance,
                                       + DLS-filtered figure strip + accessible facets
GET /api/jina/figimg/{path}           serve a figure image (on-box mount)
GET /api/jina/pdf/{aid}               serve a source PDF (on-box mount)
GET /api/jina/image/{file}            serve a 10-doc track PNG (on-box mount)
GET /api/jina/state                   what's wired (for the UI config card)
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.config import settings
from app.services.jina_dls import ANALYSTS, dls_bool, dls_filter, get_analyst
from app.services.llm import invoke_llm

router = APIRouter()


def _es_auth() -> tuple[str, str] | None:
    if settings.ES_USER and settings.ES_PASSWORD:
        return (settings.ES_USER, settings.ES_PASSWORD)
    return None


async def _es_search(index: str, body: dict) -> dict:
    url = f"{settings.jina_es_url}/{index}/_search"
    async with httpx.AsyncClient(timeout=30, auth=_es_auth()) as c:
        r = await c.post(url, json=body)
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return r.json()


async def _omni_embed(text: str) -> list[float]:
    """Embed one query string via the local Jina omni server (OpenAI shape)."""
    url = f"{settings.JINA_OMNI_URL}/v1/embeddings"
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(url, json={"input": [text], "model": settings.JINA_OMNI_MODEL})
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"omni embed failed: {r.text[:300]}")
    return r.json()["data"][0]["embedding"]


# ─────────────── personas ─────────────────────────────────────────────────────
@router.get("/analysts")
async def analysts():
    return list(ANALYSTS.values())


@router.get("/state")
async def state():
    return {
        "omni_url": settings.JINA_OMNI_URL,
        "omni_model": settings.JINA_OMNI_MODEL,
        "es_url": settings.jina_es_url,
        "mm_index": settings.JINA_MM_INDEX,
        "mm_dims": settings.JINA_MM_DIMS,
        "dls_index": settings.JINA_DLS_INDEX,
        "dls_dims": settings.JINA_DLS_DIMS,
    }


# ─────────────── track 1: search images by typing ────────────────────────────
@router.get("/multimodal/search")
async def multimodal_search(
    q: str = Query(..., min_length=1),
    space: str = Query("image", pattern="^(image|caption)$"),
    k: int = Query(6, ge=1, le=24),
):
    """One native ES query: ES embeds the text via the omni inference endpoint
    and runs kNN against the image (or caption) vectors. No app-side embedding."""
    field = "image_vector" if space == "image" else "caption_vector"
    body = {
        "knn": {
            "field": field,
            "k": k,
            "num_candidates": max(k * 4, 20),
            "query_vector_builder": {
                "text_embedding": {
                    "model_id": settings.JINA_MM_INFERENCE_ID,
                    "model_text": q,
                }
            },
        },
        "_source": ["doc_id", "caption", "file"],
    }
    res = await _es_search(settings.JINA_MM_INDEX, body)
    hits = [
        {
            "id": h.get("_id"),
            "score": h.get("_score"),
            "doc_id": h["_source"].get("doc_id"),
            "caption": h["_source"].get("caption"),
            "file": h["_source"].get("file"),
        }
        for h in res.get("hits", {}).get("hits", [])
    ]
    return {"took_ms": res.get("took"), "space": space, "hits": hits}


# ─────────────── track 2: DLS Need-to-Know ───────────────────────────────────
@router.get("/search")
async def dls_search(
    q: str = Query("", description="natural-language query; empty = browse corpus"),
    analyst: str = Query("public"),
):
    a = get_analyst(analyst)
    dls = dls_bool(a)
    clauses, must_not = dls_filter(a)

    # accessible-corpus size + facets (DLS-filtered), independent of the query text
    facet_body = {
        "size": 0,
        "query": dls,
        "aggs": {
            "docs": {"cardinality": {"field": "parent_id"}},
            "classification": {"terms": {"field": "classification", "size": 5}},
            "journal": {"terms": {"field": "journal", "size": 6}},
            "source_type": {"terms": {"field": "source_type", "size": 5}},
            "year": {"terms": {"field": "year", "size": 6}},
        },
    }

    out: dict[str, Any] = {
        "analyst": {k: a[k] for k in ("id", "name", "clearance", "compartments", "noforn", "label")},
        "hits": [],
        "figures": [],
    }

    facet_res = await _es_search(settings.JINA_DLS_INDEX, facet_body)
    aggs = facet_res.get("aggregations", {})
    out["accessible"] = {
        "docs": aggs.get("docs", {}).get("value", 0),
        "chunks": facet_res.get("hits", {}).get("total", {}).get("value", 0),
        "classification": _buckets(aggs, "classification"),
        "journal": _buckets(aggs, "journal"),
        "source_type": _buckets(aggs, "source_type"),
        "year": _buckets(aggs, "year"),
    }

    if not q.strip():
        return out  # browse mode — just the accessible corpus + facets

    vec = await _omni_embed(q)

    # hybrid RRF (BM25 on content + kNN on embedding) with the DLS pre-filter,
    # collapsed to one row per source document
    search_body = {
        "retriever": {
            "rrf": {
                "filter": dls,
                "retrievers": [
                    {"standard": {"query": {"match": {"content": q}}}},
                    {"knn": {"field": "embedding", "k": 50, "num_candidates": 200, "query_vector": vec}},
                ],
            }
        },
        "collapse": {
            "field": "parent_id",
            "inner_hits": {
                "name": "p",
                "size": 1,
                "_source": ["content", "section", "chunk_type", "page", "media_path"],
            },
        },
        "size": 8,
        "_source": [
            "parent_id", "doc_title", "journal", "year",
            "classification", "compartments", "caveats", "source_type",
        ],
    }
    res = await _es_search(settings.JINA_DLS_INDEX, search_body)
    out["took_ms"] = res.get("took")
    for h in res.get("hits", {}).get("hits", []):
        s = h.get("_source", {})
        inner = (
            h.get("inner_hits", {}).get("p", {}).get("hits", {}).get("hits", [])
        )
        passage = inner[0]["_source"] if inner else {}
        out["hits"].append({
            "parent_id": s.get("parent_id"),
            "doc_title": s.get("doc_title"),
            "journal": s.get("journal"),
            "year": s.get("year"),
            "classification": s.get("classification"),
            "compartments": s.get("compartments", []),
            "caveats": s.get("caveats", []),
            "source_type": s.get("source_type"),
            "score": h.get("_score"),
            "passage": passage.get("content", ""),
            "section": passage.get("section", ""),
        })

    # cross-modal figure strip — DLS-filtered kNN restricted to image chunks
    fig_body = {
        "knn": {
            "field": "embedding",
            "k": 6,
            "num_candidates": 120,
            "query_vector": vec,
            "filter": {"bool": {"filter": clauses + [{"term": {"chunk_type": "image"}}], "must_not": must_not}},
        },
        "size": 6,
        "_source": ["parent_id", "doc_title", "media_path", "page", "classification", "compartments", "caveats", "source_type"],
    }
    fig_res = await _es_search(settings.JINA_DLS_INDEX, fig_body)
    for h in fig_res.get("hits", {}).get("hits", []):
        s = h.get("_source", {})
        out["figures"].append({
            "parent_id": s.get("parent_id"),
            "doc_title": s.get("doc_title"),
            "media_path": s.get("media_path"),
            "page": s.get("page"),
            "classification": s.get("classification"),
            "compartments": s.get("compartments", []),
            "caveats": s.get("caveats", []),
            "score": h.get("_score"),
        })
    return out


def _buckets(aggs: dict, name: str) -> list[dict]:
    return [
        {"key": b["key"], "count": b["doc_count"]}
        for b in aggs.get(name, {}).get("buckets", [])
    ]


# ─────────────── generative "Research Paper Analyst" ─────────────────────────
ANALYST_SYSTEM = (
    "You are a research analyst answering questions about a corpus of scientific "
    "papers. You may ONLY use the passages provided — they have already been "
    "filtered to documents this user is cleared to see under need-to-know rules. "
    "If the passages do not contain the answer, say so plainly; never invent or "
    "use outside knowledge. Cite every claim with the source tag like [PMC1234567]. "
    "Be concise and factual. Use Markdown."
)


@router.get("/analyst/answer")
async def analyst_answer(
    q: str = Query(..., min_length=1),
    analyst: str = Query("public"),
    k: int = Query(6, ge=1, le=10),
):
    """DLS-filtered RAG: retrieve only what the analyst may see, then have the
    local LLM answer from those passages. The answer is grounded in — and limited
    to — the analyst's accessible corpus, so two clearances get different answers.
    """
    a = get_analyst(analyst)
    vec = await _omni_embed(q)
    dls = dls_bool(a)

    body = {
        "retriever": {
            "rrf": {
                "filter": dls,
                "retrievers": [
                    {"standard": {"query": {"match": {"content": q}}}},
                    {"knn": {"field": "embedding", "k": 50, "num_candidates": 200, "query_vector": vec}},
                ],
            }
        },
        "collapse": {
            "field": "parent_id",
            "inner_hits": {"name": "p", "size": 1, "_source": ["content", "section", "media_path", "chunk_type"]},
        },
        "size": k,
        "_source": ["parent_id", "doc_title", "classification", "compartments", "caveats", "journal", "year"],
    }
    res = await _es_search(settings.JINA_DLS_INDEX, body)
    hits = res.get("hits", {}).get("hits", [])

    sources = []
    ctx_lines = []
    for h in hits:
        s = h.get("_source", {})
        inner = h.get("inner_hits", {}).get("p", {}).get("hits", {}).get("hits", [])
        passage = (inner[0]["_source"].get("content", "") if inner else "")[:1200]
        pid = s.get("parent_id")
        sources.append({
            "parent_id": pid,
            "doc_title": s.get("doc_title"),
            "classification": s.get("classification"),
            "compartments": s.get("compartments", []),
            "caveats": s.get("caveats", []),
            "journal": s.get("journal"),
            "year": s.get("year"),
        })
        ctx_lines.append(f"[{pid}] ({s.get('doc_title')}, {s.get('classification')}): {passage}")

    if not sources:
        return {
            "analyst": {kk: a[kk] for kk in ("id", "name", "clearance", "label")},
            "answer": "_No documents in your accessible corpus match this question. "
                      "Another clearance level may see relevant material._",
            "sources": [],
        }

    prompt = (
        f"Question: {q}\n\n"
        f"Passages (the only material you may use):\n" + "\n\n".join(ctx_lines) +
        "\n\nAnswer the question, citing sources like [PMC1234567]."
    )
    answer = await invoke_llm(prompt, system=ANALYST_SYSTEM, max_tokens=900, temperature=0.1)

    return {
        "analyst": {kk: a[kk] for kk in ("id", "name", "clearance", "label")},
        "answer": answer,
        "sources": sources,
    }


# ─────────────── media (on-box mounts) ───────────────────────────────────────
def _safe_join(base: str, rel: str) -> Path:
    root = Path(base).resolve()
    target = (root / rel).resolve()
    if not str(target).startswith(str(root)):
        raise HTTPException(status_code=400, detail="bad path")
    return target


@router.get("/figimg/{path:path}")
async def figimg(path: str):
    f = _safe_join(settings.JINA_FIG_DIR, path)
    if not f.is_file():
        raise HTTPException(status_code=404, detail="figure not found")
    return FileResponse(f)


@router.get("/pdf/{aid}")
async def pdf(aid: str):
    f = _safe_join(settings.JINA_PDF_DIR, f"{aid}.pdf")
    if not f.is_file():
        raise HTTPException(status_code=404, detail="pdf not found")
    return FileResponse(f, media_type="application/pdf")


@router.get("/image/{file}")
async def image(file: str):
    f = _safe_join(settings.JINA_IMG_DIR, file)
    if not f.is_file():
        raise HTTPException(status_code=404, detail="image not found")
    return FileResponse(f)
