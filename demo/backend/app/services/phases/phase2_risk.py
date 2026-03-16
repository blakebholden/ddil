"""Phase 2: Risk Analysis — LLM-based risk assessment."""

from __future__ import annotations

import logging
from typing import Callable, Optional

from app.models.agent_models import (
    HistoricalContext,
    RiskAnalysis,
    RiskItem,
    SensorSnapshot,
)
from app.services.llm import invoke_llm_json
from app.services.phases.prompts import SYSTEM_AGRONOMIST, PHASE2_RISK

logger = logging.getLogger(__name__)


def _progress(on_progress: Optional[Callable], msg: str) -> None:
    if on_progress:
        on_progress(msg)


async def run_phase2(
    sensor: SensorSnapshot,
    historical: HistoricalContext,
    user_question: str,
    on_progress: Optional[Callable] = None,
) -> RiskAnalysis:
    """Assess risks based on sensor data and historical patterns."""
    _progress(on_progress, "Analyzing risk factors...")

    prompt = PHASE2_RISK.format(
        sensor_context=sensor.summary,
        historical_summary=historical.pattern_summary,
        user_question=user_question,
    )

    result = await invoke_llm_json(prompt, system=SYSTEM_AGRONOMIST)

    if "raw_response" in result:
        return RiskAnalysis(
            risks=[],
            overall_risk="unknown",
            summary=result.get("raw_response", "Risk analysis unavailable"),
        )

    risks = [RiskItem(**r) for r in result.get("risks", [])]
    _progress(on_progress, f"Identified {len(risks)} risk factors")

    return RiskAnalysis(
        risks=risks,
        overall_risk=result.get("overall_risk", "medium"),
        summary=result.get("summary", ""),
    )
