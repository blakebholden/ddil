from __future__ import annotations

from pydantic import BaseModel


class SearchRequest(BaseModel):
    query: str
    mode: str = "hybrid"
    index: str = "vineyard-soil"
    size: int = 10


class ChatRequest(BaseModel):
    message: str
    history: list[dict] | None = None


class RaceStartRequest(BaseModel):
    index_name: str = "vineyard-soil"
    data_file: str | None = None


class SearchResult(BaseModel):
    id: str
    title: str
    snippet: str
    score: float
    source: str
    index: str


class SearchResponse(BaseModel):
    results: list[SearchResult]
    latency: dict


class ChatResponse(BaseModel):
    response: str
    sources: list[dict]
    latency: dict | None = None
