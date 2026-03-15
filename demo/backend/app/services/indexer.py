import asyncio
import json
import time
from pathlib import Path

from elasticsearch import AsyncElasticsearch
from elasticsearch.helpers import async_bulk

from app.config import settings
from app.services.elasticsearch import get_gpu_client, get_cpu_client
from app.services.metrics import RaceMetrics, PathMetrics


race_metrics = RaceMetrics()


def _load_jsonl(filepath: str) -> list[dict]:
    docs = []
    path = Path(filepath)
    if not path.exists():
        return docs
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                docs.append(json.loads(line))
    return docs


async def _index_batch(
    client: AsyncElasticsearch,
    index: str,
    docs: list[dict],
    path_metrics: PathMetrics,
    batch_size: int = 500,
):
    path_metrics.start_time = time.time()
    path_metrics.total_docs = len(docs)

    for i in range(0, len(docs), batch_size):
        batch = docs[i : i + batch_size]
        actions = [{"_index": index, "_source": doc} for doc in batch]

        t0 = time.time()
        await async_bulk(client, actions, raise_on_error=False)
        batch_ms = (time.time() - t0) * 1000

        path_metrics.record_batch(len(batch), batch_ms)

    path_metrics.complete = True


async def run_race(index_name: str = "vineyard-soil", data_file: str | None = None):
    global race_metrics
    race_metrics = RaceMetrics(status="running")

    if data_file is None:
        data_file = f"{settings.DATA_DIR}/soil-readings.jsonl"

    docs = _load_jsonl(data_file)
    if not docs:
        # Generate minimal mock data for testing
        docs = [
            {
                "timestamp": "2024-01-01T00:00:00Z",
                "vineyard_id": "test",
                "block_id": "A1",
                "source": "mock",
                "soil_moisture_pct": 35.0 + i * 0.01,
                "reading_vector": [0.1] * 8,
            }
            for i in range(1000)
        ]

    gpu_client = get_gpu_client()
    cpu_client = get_cpu_client()

    # Create indices on both instances
    for client in [gpu_client, cpu_client]:
        if await client.indices.exists(index=index_name):
            await client.indices.delete(index=index_name)
        await client.indices.create(
            index=index_name,
            body={
                "settings": {"number_of_shards": 1, "number_of_replicas": 0},
                "mappings": {
                    "properties": {
                        "timestamp": {"type": "date"},
                        "vineyard_id": {"type": "keyword"},
                        "block_id": {"type": "keyword"},
                        "source": {"type": "keyword"},
                        "soil_moisture_pct": {"type": "float"},
                        "reading_vector": {
                            "type": "dense_vector",
                            "dims": 8,
                            "index": True,
                            "similarity": "cosine",
                        },
                    }
                },
            },
        )

    # Run both indexing paths concurrently
    await asyncio.gather(
        _index_batch(
            gpu_client, index_name, docs, race_metrics.gpu, settings.RACE_BATCH_SIZE
        ),
        _index_batch(
            cpu_client, index_name, docs, race_metrics.cpu, settings.RACE_BATCH_SIZE
        ),
    )

    race_metrics.status = "complete"


def get_race_metrics() -> RaceMetrics:
    return race_metrics


async def reset_race(index_name: str = "vineyard-soil"):
    global race_metrics
    gpu_client = get_gpu_client()
    cpu_client = get_cpu_client()

    for client in [gpu_client, cpu_client]:
        try:
            if await client.indices.exists(index=index_name):
                await client.indices.delete(index=index_name)
        except Exception:
            pass

    race_metrics = RaceMetrics()
