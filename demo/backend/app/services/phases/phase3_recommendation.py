"""Phase 3: Crop Recommendations — LLM-based advisory."""

from __future__ import annotations

import logging
from typing import Callable, Optional

from app.models.agent_models import (
    CropRecommendation,
    Recommendation,
    RiskAnalysis,
    SensorSnapshot,
)
from app.services.llm import invoke_llm_json
from app.services.phases.prompts import SYSTEM_AGRONOMIST, PHASE3_RECOMMENDATION

logger = logging.getLogger(__name__)


def _progress(on_progress: Optional[Callable], msg: str) -> None:
    if on_progress:
        on_progress(msg)


async def run_phase3(
    sensor: SensorSnapshot,
    risk: RiskAnalysis,
    user_question: str,
    variety: str = "Cabernet Sauvignon",
    on_progress: Optional[Callable] = None,
) -> CropRecommendation:
    """Generate crop management recommendations."""
    _progress(on_progress, "Generating crop management recommendations...")

    risk_summary = risk.summary
    if risk.risks:
        risk_items = "; ".join(
            f"{r.category} ({r.severity}): {r.description}" for r in risk.risks
        )
        risk_summary = f"{risk.summary}\nDetailed risks: {risk_items}"

    prompt = PHASE3_RECOMMENDATION.format(
        sensor_context=sensor.summary,
        risk_summary=risk_summary,
        variety=variety,
        user_question=user_question,
    )

    result = await invoke_llm_json(prompt, system=SYSTEM_AGRONOMIST)

    if "raw_response" in result:
        return CropRecommendation(
            recommendations=[],
            variety_notes="",
            summary=result.get("raw_response", "Recommendations unavailable"),
        )

    recs = [Recommendation(**r) for r in result.get("recommendations", [])]
    _progress(on_progress, f"Generated {len(recs)} recommendations")

    return CropRecommendation(
        recommendations=recs,
        variety_notes=result.get("variety_notes", ""),
        summary=result.get("summary", ""),
    )
