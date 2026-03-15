from elasticsearch import AsyncElasticsearch

from app.config import settings

_gpu_client: AsyncElasticsearch | None = None
_cpu_client: AsyncElasticsearch | None = None


def get_gpu_client() -> AsyncElasticsearch:
    global _gpu_client
    if _gpu_client is None:
        _gpu_client = AsyncElasticsearch(
            settings.es_gpu_url,
            request_timeout=30,
        )
    return _gpu_client


def get_cpu_client() -> AsyncElasticsearch:
    global _cpu_client
    if _cpu_client is None:
        _cpu_client = AsyncElasticsearch(
            settings.es_cpu_url,
            request_timeout=30,
        )
    return _cpu_client


async def close_clients():
    global _gpu_client, _cpu_client
    if _gpu_client:
        await _gpu_client.close()
        _gpu_client = None
    if _cpu_client:
        await _cpu_client.close()
        _cpu_client = None
