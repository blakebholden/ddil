"""Pydantic models for the agentic vineyard advisor pipeline."""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


# ── Phase Result Models ──────────────────────────────────────────────

class SensorSnapshot(BaseModel):
    """Phase 0: Current sensor readings for the query context."""
    block_id: Optional[str] = None
    moisture: Optional[float] = None
    temperature: Optional[float] = None
    nitrogen: Optional[float] = None
    phosphorus: Optional[float] = None
    potassium: Optional[float] = None
    ph: Optional[float] = None
    health_status: Optional[str] = None
    summary: str = ""


class HistoricalMatch(BaseModel):
    title: str = ""
    similarity: float = 0.0
    year: Optional[int] = None
    outcome: str = ""
    conditions: str = ""


class HistoricalContext(BaseModel):
    """Phase 1: Similar historical conditions from kNN search."""
    matches: list[HistoricalMatch] = []
    pattern_summary: str = ""
    years_of_data: int = 0


class RiskItem(BaseModel):
    category: str = ""
    severity: str = "low"  # low, medium, high, critical
    description: str = ""
    confidence: float = 0.0


class RiskAnalysis(BaseModel):
    """Phase 2: Risk assessment based on sensor + historical data."""
    risks: list[RiskItem] = []
    overall_risk: str = "low"
    summary: str = ""


class Recommendation(BaseModel):
    action: str = ""
    priority: str = "medium"  # low, medium, high, urgent
    rationale: str = ""
    timing: str = ""


class CropRecommendation(BaseModel):
    """Phase 3: Specific crop management recommendations."""
    recommendations: list[Recommendation] = []
    variety_notes: str = ""
    summary: str = ""


class ActionItem(BaseModel):
    task: str = ""
    assignee: str = "Field Crew"
    deadline: str = ""
    equipment: str = ""
    notes: str = ""


class ActionPlan(BaseModel):
    """Phase 4: Prioritized action plan."""
    actions: list[ActionItem] = []
    estimated_cost: str = ""
    summary: str = ""


# ── SSE Event Models ────────────────────────────────────────────────

class PhaseEvent(BaseModel):
    phase_id: str
    phase_name: str
    status: str  # "start", "progress", "complete", "error"
    message: str = ""
    data: Optional[dict] = None
    progress_pct: int = 0


class JobEvent(BaseModel):
    job_id: str
    status: str  # "start", "complete", "error"
    message: str = ""
    results: Optional[dict] = None


# ── API Models ──────────────────────────────────────────────────────

class AgentChatRequest(BaseModel):
    message: str
    block_id: Optional[str] = None
    history: Optional[list[dict]] = None
    force: bool = False


class AgentChatResponse(BaseModel):
    job_id: str
    status: str = "started"
