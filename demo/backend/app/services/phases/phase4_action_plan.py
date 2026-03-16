"""Phase 4: Action Plan — LLM-based task generation."""

from __future__ import annotations

import logging
from typing import Callable, Optional

from app.models.agent_models import (
    ActionItem,
    ActionPlan,
    CropRecommendation,
)
from app.services.llm import invoke_llm_json
from app.services.phases.prompts import SYSTEM_AGRONOMIST, PHASE4_ACTION_PLAN

logger = logging.getLogger(__name__)


def _progress(on_progress: Optional[Callable], msg: str) -> None:
    if on_progress:
        on_progress(msg)


async def run_phase4(
    recommendation: CropRecommendation,
    on_progress: Optional[Callable] = None,
) -> ActionPlan:
    """Convert recommendations into a concrete action plan."""
    _progress(on_progress, "Building action plan...")

    rec_text = "\n".join(
        f"- [{r.priority.upper()}] {r.action}: {r.rationale} (timing: {r.timing})"
        for r in recommendation.recommendations
    ) if recommendation.recommendations else recommendation.summary

    prompt = PHASE4_ACTION_PLAN.format(recommendations=rec_text)

    result = await invoke_llm_json(prompt, system=SYSTEM_AGRONOMIST)

    if "raw_response" in result:
        return ActionPlan(
            actions=[],
            estimated_cost="",
            summary=result.get("raw_response", "Action plan unavailable"),
        )

    actions = [ActionItem(**a) for a in result.get("actions", [])]
    _progress(on_progress, f"Created {len(actions)}-step action plan")

    return ActionPlan(
        actions=actions,
        estimated_cost=result.get("estimated_cost", ""),
        summary=result.get("summary", ""),
    )
