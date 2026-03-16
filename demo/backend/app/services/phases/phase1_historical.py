"""Phase 1: Historical Context — kNN search + LLM analysis."""

from __future__ import annotations

import logging
from typing import Callable, Optional

from app.models.agent_models import HistoricalContext, HistoricalMatch, SensorSnapshot
from app.services.elasticsearch import get_gpu_client
from app.services.embedder import embed_text
from app.services.llm import invoke_llm_json
from app.services.phases.prompts import SYSTEM_AGRONOMIST, PHASE1_HISTORICAL

logger = logging.getLogger(__name__)


def _progress(on_progress: Optional[Callable], msg: str) -> None:
    if on_progress:
        on_progress(msg)


async def run_phase1(
    sensor: SensorSnapshot,
    on_progress: Optional[Callable] = None,
) -> HistoricalContext:
    """Find similar historical conditions via kNN, then LLM-analyze patterns."""
    _progress(on_progress, "Embedding current conditions for kNN search...")

    # Build a text representation for embedding
    condition_text = (
        f"soil moisture {sensor.moisture}% temperature {sensor.temperature}C "
        f"nitrogen {sensor.nitrogen} phosphorus {sensor.phosphorus} "
        f"potassium {sensor.potassium} pH {sensor.ph}"
    )

    es = get_gpu_client()
    historical_hits: list[dict] = []

    if es is not None:
        try:
            vector = await embed_text(condition_text)
            _progress(on_progress, "Running kNN search against historical records...")

            resp = await es.search(
                index="vineyard-soil",
                body={
                    "size": 5,
                    "knn": {
                        "field": "reading_vector",
                        "query_vector": vector,
                        "k": 5,
                        "num_candidates": 50,
                    },
                    "_source": [
                        "station", "year", "vwc_percent", "soil_temp_c",
                        "nitrogen_ppm", "crop_type", "yield_bushels_acre",
                    ],
                },
            )
            for hit in resp.get("hits", {}).get("hits", []):
                src = hit["_source"]
                historical_hits.append({
                    "score": hit.get("_score", 0),
                    **src,
                })
            _progress(on_progress, f"Found {len(historical_hits)} similar historical records")
        except Exception as e:
            logger.warning("Phase 1 kNN search failed: %s", e)
            _progress(on_progress, "kNN search failed — using mock historical data")

    if not historical_hits:
        historical_hits = _mock_historical()
        _progress(on_progress, "Using simulated historical context")

    # LLM analysis
    _progress(on_progress, "Analyzing historical patterns with LLM...")
    prompt = PHASE1_HISTORICAL.format(
        sensor_context=sensor.summary,
        historical_hits=_format_hits(historical_hits),
    )

    result = await invoke_llm_json(prompt, system=SYSTEM_AGRONOMIST)

    if "raw_response" in result:
        return HistoricalContext(
            matches=[],
            pattern_summary=result.get("raw_response", "Analysis unavailable"),
            years_of_data=0,
        )

    matches = [HistoricalMatch(**m) for m in result.get("matches", [])]
    return HistoricalContext(
        matches=matches,
        pattern_summary=result.get("pattern_summary", ""),
        years_of_data=result.get("years_of_data", len(matches)),
    )


def _format_hits(hits: list[dict]) -> str:
    lines = []
    for i, h in enumerate(hits, 1):
        lines.append(
            f"{i}. Station: {h.get('station','?')} | Year: {h.get('year','?')} | "
            f"VWC: {h.get('vwc_percent','?')}% | Temp: {h.get('soil_temp_c','?')}°C | "
            f"N: {h.get('nitrogen_ppm','?')} | Crop: {h.get('crop_type','?')} | "
            f"Yield: {h.get('yield_bushels_acre','?')} bu/acre | Score: {h.get('score',0):.3f}"
        )
    return "\n".join(lines) if lines else "No historical records available."


def _mock_historical() -> list[dict]:
    return [
        {
            "station": "Cook Farm Station 22",
            "year": 2012,
            "vwc_percent": 29.5,
            "soil_temp_c": 17.2,
            "nitrogen_ppm": 38,
            "crop_type": "Winter Wheat",
            "yield_bushels_acre": 42,
            "score": 0.94,
        },
        {
            "station": "Cook Farm Station 14",
            "year": 2018,
            "vwc_percent": 33.1,
            "soil_temp_c": 15.8,
            "nitrogen_ppm": 55,
            "crop_type": "Spring Barley",
            "yield_bushels_acre": 68,
            "score": 0.87,
        },
        {
            "station": "Cook Farm Station 8",
            "year": 2015,
            "vwc_percent": 27.3,
            "soil_temp_c": 19.1,
            "nitrogen_ppm": 31,
            "crop_type": "Winter Wheat",
            "yield_bushels_acre": 28,
            "score": 0.82,
        },
    ]
