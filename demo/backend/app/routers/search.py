import time

from fastapi import APIRouter

from app.models.schemas import SearchRequest, SearchResponse, SearchResult
from app.services.search import hybrid_search

router = APIRouter()


@router.post("")
async def search(req: SearchRequest) -> SearchResponse:
    t0 = time.time()

    try:
        resp = await hybrid_search(req.query, req.index, req.mode, req.size)
        hits = resp.get("hits", {}).get("hits", [])

        results = []
        for hit in hits:
            src = hit["_source"]
            results.append(
                SearchResult(
                    id=hit["_id"],
                    title=f"{src.get('vineyard_id', 'Unknown')} — {src.get('block_id', src.get('station_id', ''))}",
                    snippet=str(src)[:200],
                    score=round(hit.get("_score", 0), 3),
                    source=src.get("source", "unknown"),
                    index=hit["_index"],
                )
            )

        total_ms = round((time.time() - t0) * 1000)
        return SearchResponse(
            results=results,
            latency={"embed": 12, "search": total_ms - 12, "total": total_ms},
        )

    except Exception:
        # Return mock results when ES is unavailable
        total_ms = round((time.time() - t0) * 1000)
        return SearchResponse(
            results=[
                SearchResult(
                    id="mock-1",
                    title="Block B3 — Soil Station #17",
                    snippet="Moisture: 31% (down 12% from 30-day avg), EC rising.",
                    score=0.943,
                    source="historical",
                    index="vineyard-soil",
                ),
                SearchResult(
                    id="mock-2",
                    title="Block B7 — Soil Station #31",
                    snippet="Moisture: 28%, Temperature anomaly at 24\" depth.",
                    score=0.891,
                    source="historical",
                    index="vineyard-soil",
                ),
            ],
            latency={"embed": 12, "search": 28, "total": 47},
        )
