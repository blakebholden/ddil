import httpx

from app.config import settings


async def embed_text(text: str) -> list[float]:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{settings.OLLAMA_EMBED_URL}/api/embed",
            json={"model": settings.EMBED_MODEL, "input": text},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["embeddings"][0]


async def embed_batch(texts: list[str]) -> list[list[float]]:
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{settings.OLLAMA_EMBED_URL}/api/embed",
            json={"model": settings.EMBED_MODEL, "input": texts},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["embeddings"]
