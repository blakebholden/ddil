"""Phase 0: Sensor Snapshot — ES-only, no LLM call."""

from __future__ import annotations

import logging
from typing import Callable, Optional

from app.models.agent_models import SensorSnapshot
from app.services.elasticsearch import get_gpu_client

logger = logging.getLogger(__name__)


def _progress(on_progress: Optional[Callable], msg: str) -> None:
    if on_progress:
        on_progress(msg)


async def run_phase0(
    block_id: Optional[str] = None,
    on_progress: Optional[Callable] = None,
) -> SensorSnapshot:
    """Fetch current sensor data from Elasticsearch. No LLM needed."""
    _progress(on_progress, "Querying sensor indices...")

    es = get_gpu_client()
    if es is None:
        _progress(on_progress, "ES unavailable — using simulated data")
        return _mock_snapshot(block_id)

    try:
        # Search vineyard-soil index for latest readings
        query: dict = {"size": 1, "sort": [{"timestamp": {"order": "desc"}}]}
        if block_id:
            query["query"] = {"term": {"block_id": block_id}}
        else:
            query["query"] = {"match_all": {}}

        resp = await es.search(index="vineyard-soil", body=query)
        hits = resp.get("hits", {}).get("hits", [])

        if not hits:
            _progress(on_progress, "No sensor data found — using simulated data")
            return _mock_snapshot(block_id)

        src = hits[0]["_source"]
        _progress(on_progress, f"Retrieved sensor data for block {src.get('block_id', block_id or 'A1')}")

        return SensorSnapshot(
            block_id=src.get("block_id", block_id),
            moisture=src.get("vwc_percent"),
            temperature=src.get("soil_temp_c"),
            nitrogen=src.get("nitrogen_ppm"),
            phosphorus=src.get("phosphorus_ppm"),
            potassium=src.get("potassium_ppm"),
            ph=src.get("ph"),
            health_status="healthy",
            summary=_summarize(src),
        )
    except Exception as e:
        logger.warning("Phase 0 ES query failed: %s", e)
        _progress(on_progress, "ES query failed — using simulated data")
        return _mock_snapshot(block_id)


def _summarize(src: dict) -> str:
    parts = []
    if vwc := src.get("vwc_percent"):
        status = "drought stress" if vwc < 28 else "low" if vwc < 33 else "optimal" if vwc < 42 else "saturated"
        parts.append(f"Moisture {vwc:.1f}% ({status})")
    if temp := src.get("soil_temp_c"):
        parts.append(f"Soil temp {temp:.1f}°C")
    if n := src.get("nitrogen_ppm"):
        parts.append(f"N:{n:.0f} mg/kg")
    return " | ".join(parts) if parts else "No sensor summary available"


def _mock_snapshot(block_id: Optional[str] = None) -> SensorSnapshot:
    """Simulated data when ES is unavailable."""
    return SensorSnapshot(
        block_id=block_id or "B3",
        moisture=31.2,
        temperature=16.8,
        nitrogen=42.0,
        phosphorus=28.0,
        potassium=145.0,
        ph=6.2,
        health_status="watch",
        summary="Moisture 31.2% (low) | Soil temp 16.8°C | N:42 mg/kg",
    )
