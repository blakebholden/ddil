"""Prompt templates for vineyard advisor phases."""

SYSTEM_AGRONOMIST = """You are a precision viticulture advisor operating in a disconnected, \
degraded, intermittent, limited (DDIL) environment. You have access to local sensor data, \
historical soil/weather records, and crop management knowledge stored in Elasticsearch. \
Be specific, actionable, and concise. Reference data points when available. \
Always respond in valid JSON matching the requested schema."""


PHASE1_HISTORICAL = """Analyze these historical soil/weather records that are similar to the \
current vineyard conditions.

## Current Conditions
{sensor_context}

## Similar Historical Records (from kNN vector search)
{historical_hits}

## Task
Identify patterns in the historical data that are relevant to the current conditions. \
Look for outcomes (good harvests, disease outbreaks, crop loss) that followed similar conditions.

Respond in JSON:
{{
  "matches": [
    {{
      "title": "descriptive name for this historical match",
      "similarity": 0.0-1.0,
      "year": 2020,
      "outcome": "what happened",
      "conditions": "brief condition summary"
    }}
  ],
  "pattern_summary": "overall pattern analysis",
  "years_of_data": 10
}}"""


PHASE2_RISK = """Based on the sensor snapshot and historical patterns, assess the risks \
facing this vineyard block.

## Current Sensor Data
{sensor_context}

## Historical Pattern Analysis
{historical_summary}

## User Question
{user_question}

## Task
Identify and rank all risks. Consider: disease pressure, moisture stress, nutrient \
deficiency/toxicity, temperature extremes, pH imbalance.

Respond in JSON:
{{
  "risks": [
    {{
      "category": "disease|moisture|nutrient|temperature|pH",
      "severity": "low|medium|high|critical",
      "description": "specific risk description",
      "confidence": 0.0-1.0
    }}
  ],
  "overall_risk": "low|medium|high|critical",
  "summary": "1-2 sentence risk summary"
}}"""


PHASE3_RECOMMENDATION = """Based on the risk analysis and current conditions, provide \
specific crop management recommendations for this vineyard block.

## Current Conditions
{sensor_context}

## Risk Analysis
{risk_summary}

## Grape Variety
{variety}

## User Question
{user_question}

## Task
Provide actionable recommendations ordered by priority. Consider irrigation, fertilization, \
pest/disease management, canopy management, and harvest timing.

Respond in JSON:
{{
  "recommendations": [
    {{
      "action": "specific action to take",
      "priority": "low|medium|high|urgent",
      "rationale": "why this matters",
      "timing": "when to do it"
    }}
  ],
  "variety_notes": "variety-specific considerations",
  "summary": "1-2 sentence recommendation summary"
}}"""


PHASE4_ACTION_PLAN = """Create a concrete action plan from these recommendations.

## Recommendations
{recommendations}

## Available Resources
Field crew (3 people), standard vineyard equipment, limited chemical inventory (copper fungicide, \
sulfur, standard NPK fertilizers), drip irrigation system.

## Task
Convert recommendations into a day-by-day action plan with specific tasks, assignments, \
and equipment needs.

Respond in JSON:
{{
  "actions": [
    {{
      "task": "specific task description",
      "assignee": "Field Crew|Manager|Lab",
      "deadline": "today|tomorrow|this week|next week",
      "equipment": "required equipment",
      "notes": "additional notes"
    }}
  ],
  "estimated_cost": "rough cost estimate",
  "summary": "1-2 sentence plan summary"
}}"""
