"""LLM integration via Ollama (local, airgapped)."""

import json
import httpx

from app.config import settings


async def invoke_llm(
    prompt: str,
    system: str = "",
    max_tokens: int = 4000,
    temperature: float = 0.1,
) -> str:
    """Call Ollama LLM with a single prompt."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{settings.OLLAMA_LLM_URL}/api/chat",
            json={
                "model": settings.LLM_MODEL,
                "messages": messages,
                "stream": False,
                "options": {"num_predict": max_tokens, "temperature": temperature},
            },
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"]


async def invoke_llm_json(
    prompt: str,
    system: str = "",
    max_tokens: int = 4000,
    temperature: float = 0.1,
) -> dict:
    """Call LLM and parse JSON response. Falls back to raw text on parse failure."""
    text = await invoke_llm(prompt, system, max_tokens, temperature)

    # Try to extract JSON from response
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find JSON block in markdown
    if "```json" in text:
        start = text.index("```json") + 7
        end = text.index("```", start)
        try:
            return json.loads(text[start:end].strip())
        except json.JSONDecodeError:
            pass
    elif "```" in text:
        start = text.index("```") + 3
        end = text.index("```", start)
        try:
            return json.loads(text[start:end].strip())
        except json.JSONDecodeError:
            pass

    # Find first { ... } block
    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start >= 0 and brace_end > brace_start:
        try:
            return json.loads(text[brace_start : brace_end + 1])
        except json.JSONDecodeError:
            pass

    return {"raw_response": text}
