import httpx

from app.config import settings
from app.services.search import hybrid_search


SYSTEM_PROMPT = """You are an AI agronomist assistant for a precision viticulture operation.
You have access to soil sensor data, NPK nutrient profiles, weather data, harvest quality records,
and 9 years of historical baseline data from the USDA Cook Farm sensor network.

Answer questions about vineyard conditions, crop health, irrigation recommendations, and
soil management based on the retrieved context. Be specific and cite data when possible."""


async def rag_query(message: str, history: list[dict] | None = None) -> dict:
    # Step 1: Retrieve context via hybrid search
    search_resp = await hybrid_search(message, mode="hybrid", size=5)
    hits = search_resp.get("hits", {}).get("hits", [])

    context_parts = []
    sources = []
    for hit in hits:
        src = hit["_source"]
        context_parts.append(str(src))
        sources.append({
            "title": f"{src.get('vineyard_id', 'Unknown')} — {src.get('block_id', '')}",
            "index": hit["_index"],
            "score": round(hit.get("_score", 0), 2),
        })

    context = "\n\n".join(context_parts[:5])

    # Step 2: Build messages for LLM
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        messages.extend(history)
    messages.append({
        "role": "user",
        "content": f"Context from database:\n{context}\n\nUser question: {message}",
    })

    # Step 3: Generate response via Ollama
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{settings.OLLAMA_LLM_URL}/api/chat",
            json={
                "model": settings.LLM_MODEL,
                "messages": messages,
                "stream": False,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    return {
        "response": data["message"]["content"],
        "sources": sources,
    }
