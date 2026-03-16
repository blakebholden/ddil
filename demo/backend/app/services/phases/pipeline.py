"""Vineyard advisor pipeline — orchestrates phases with SSE events."""

from __future__ import annotations

import json
import logging
import uuid
from typing import AsyncGenerator

from app.models.agent_models import AgentChatRequest
from app.services.phases.phase0_sensors import run_phase0
from app.services.phases.phase1_historical import run_phase1
from app.services.phases.phase2_risk import run_phase2
from app.services.phases.phase3_recommendation import run_phase3
from app.services.phases.phase4_action_plan import run_phase4

logger = logging.getLogger(__name__)

PHASES = [
    {"id": "sensors", "name": "Sensor Snapshot", "index": 0},
    {"id": "historical", "name": "Historical Context", "index": 1},
    {"id": "risk", "name": "Risk Analysis", "index": 2},
    {"id": "recommendation", "name": "Crop Recommendation", "index": 3},
    {"id": "action_plan", "name": "Action Plan", "index": 4},
]


def _sse(event: str, data: dict) -> str:
    """Format a Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


async def run_pipeline(request: AgentChatRequest) -> AsyncGenerator[str, None]:
    """Execute the full 5-phase pipeline, yielding SSE events."""
    job_id = str(uuid.uuid4())[:8]
    results: dict = {}
    # Collect progress messages synchronously, drain between awaits
    progress_buffer: list[tuple[str, dict]] = []

    yield _sse("job_start", {
        "job_id": job_id,
        "phases": PHASES,
        "message": request.message,
    })

    def make_progress(phase_id: str):
        def on_progress(msg: str):
            progress_buffer.append(("phase_progress", {
                "phase_id": phase_id,
                "message": msg,
            }))
        return on_progress

    def drain_progress():
        """Yield all buffered progress events."""
        events = []
        while progress_buffer:
            evt_type, evt_data = progress_buffer.pop(0)
            events.append(_sse(evt_type, evt_data))
        return events

    try:
        # ── Phase 0: Sensor Snapshot (ES only, fast) ────────────
        yield _sse("phase_start", {"phase_id": "sensors", "phase_name": "Sensor Snapshot", "progress_pct": 0})
        sensor = await run_phase0(
            block_id=request.block_id,
            on_progress=make_progress("sensors"),
        )
        for evt in drain_progress():
            yield evt
        results["sensors"] = sensor.model_dump()
        yield _sse("phase_complete", {
            "phase_id": "sensors",
            "data": results["sensors"],
            "progress_pct": 20,
        })

        # ── Phase 1: Historical Context (kNN + LLM) ────────────
        yield _sse("phase_start", {"phase_id": "historical", "phase_name": "Historical Context", "progress_pct": 20})
        historical = await run_phase1(
            sensor=sensor,
            on_progress=make_progress("historical"),
        )
        for evt in drain_progress():
            yield evt
        results["historical"] = historical.model_dump()
        yield _sse("phase_complete", {
            "phase_id": "historical",
            "data": results["historical"],
            "progress_pct": 40,
        })

        # ── Phase 2: Risk Analysis ──────────────────────────────
        yield _sse("phase_start", {"phase_id": "risk", "phase_name": "Risk Analysis", "progress_pct": 40})
        risk = await run_phase2(
            sensor=sensor,
            historical=historical,
            user_question=request.message,
            on_progress=make_progress("risk"),
        )
        for evt in drain_progress():
            yield evt
        results["risk"] = risk.model_dump()
        yield _sse("phase_complete", {
            "phase_id": "risk",
            "data": results["risk"],
            "progress_pct": 60,
        })

        # ── Phase 3: Crop Recommendation ────────────────────────
        yield _sse("phase_start", {"phase_id": "recommendation", "phase_name": "Crop Recommendation", "progress_pct": 60})
        recommendation = await run_phase3(
            sensor=sensor,
            risk=risk,
            user_question=request.message,
            on_progress=make_progress("recommendation"),
        )
        for evt in drain_progress():
            yield evt
        results["recommendation"] = recommendation.model_dump()
        yield _sse("phase_complete", {
            "phase_id": "recommendation",
            "data": results["recommendation"],
            "progress_pct": 80,
        })

        # ── Phase 4: Action Plan ────────────────────────────────
        yield _sse("phase_start", {"phase_id": "action_plan", "phase_name": "Action Plan", "progress_pct": 80})
        action_plan = await run_phase4(
            recommendation=recommendation,
            on_progress=make_progress("action_plan"),
        )
        for evt in drain_progress():
            yield evt
        results["action_plan"] = action_plan.model_dump()
        yield _sse("phase_complete", {
            "phase_id": "action_plan",
            "data": results["action_plan"],
            "progress_pct": 100,
        })

        # ── Job Complete ────────────────────────────────────────
        yield _sse("job_complete", {
            "job_id": job_id,
            "results": results,
        })

    except Exception as e:
        logger.exception("Pipeline failed: %s", e)
        yield _sse("job_error", {
            "job_id": job_id,
            "message": str(e),
        })
