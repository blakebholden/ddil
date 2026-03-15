from app.services.elasticsearch import get_gpu_client
from app.services.embedder import embed_text


async def hybrid_search(
    query: str,
    index: str = "vineyard-soil",
    mode: str = "hybrid",
    size: int = 10,
) -> dict:
    client = get_gpu_client()

    if mode == "bm25":
        body = {"query": {"multi_match": {"query": query, "fields": ["*"]}}}
    elif mode == "semantic":
        vector = await embed_text(query)
        body = {
            "knn": {
                "field": "reading_vector",
                "query_vector": vector,
                "k": size,
                "num_candidates": size * 10,
            }
        }
    else:  # hybrid RRF
        vector = await embed_text(query)
        body = {
            "retriever": {
                "rrf": {
                    "retrievers": [
                        {
                            "standard": {
                                "query": {
                                    "multi_match": {
                                        "query": query,
                                        "fields": ["*"],
                                    }
                                }
                            }
                        },
                        {
                            "knn": {
                                "field": "reading_vector",
                                "query_vector": vector,
                                "k": size,
                                "num_candidates": size * 10,
                            }
                        },
                    ]
                }
            }
        }

    resp = await client.search(index=index, body=body, size=size)
    return resp
