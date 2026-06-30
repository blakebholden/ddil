#!/usr/bin/env bash
# setup-indices-local.sh — create the two Jina indices + the ES inference
# endpoint + ingest pipeline for the multimodal/DLS adventure, on the kit's
# local cluster. Run AFTER the Jina omni server is up (see JINA-SETUP.md).
#
#   jina-multimodal   — 10-doc "search images by typing" track (768-d, 2 fields)
#   pmc-unstructured  — research-paper DLS track (1024-d bbq_hnsw + DLS markings)
#
# Usage:
#   ES_URL=http://192.168.1.20:9200 OMNI_URL=http://192.168.1.20:8081 \
#   EP=changeme bash setup-indices-local.sh
set -euo pipefail

ES="${ES_URL:-http://192.168.1.20:9200}"
OMNI="${OMNI_URL:-http://192.168.1.20:8081}"
OMNI_MODEL="${OMNI_MODEL:-jina-embeddings-v5-omni-small}"
INFER_ID="${INFER_ID:-jina-omni-text}"
EP="${EP:-changeme}"
EU="${EU:-elastic}"
AUTH=(-u "$EU:$EP")
H=("${AUTH[@]}" -H 'Content-Type: application/json')

echo "==> ES inference endpoint '$INFER_ID' → $OMNI (omni @ 768-d)"
curl -sS "${H[@]}" -X DELETE "$ES/_inference/text_embedding/$INFER_ID" >/dev/null 2>&1 || true
curl -sS "${H[@]}" -X PUT "$ES/_inference/text_embedding/$INFER_ID" -d @- <<JSON >/dev/null
{
  "service": "openai",
  "service_settings": {
    "api_key": "sk-airgap-dummy",
    "model_id": "${OMNI_MODEL}",
    "url": "${OMNI}/v1/embeddings",
    "dimensions": 768
  }
}
JSON

echo "==> ingest pipeline 'jina-embed-caption'"
curl -sS "${H[@]}" -X PUT "$ES/_ingest/pipeline/jina-embed-caption" -d @- <<JSON >/dev/null
{
  "description": "Embed doc caption with local Jina omni (air-gapped)",
  "processors": [
    {"inference": {"model_id": "${INFER_ID}",
      "input_output": [{"input_field": "caption", "output_field": "caption_vector"}]}}
  ]
}
JSON

echo "==> index 'jina-multimodal' (768-d, image_vector + caption_vector)"
curl -sS "${H[@]}" -X DELETE "$ES/jina-multimodal" >/dev/null 2>&1 || true
curl -sS "${H[@]}" -X PUT "$ES/jina-multimodal" -d @- <<'JSON' >/dev/null
{
  "mappings": {"properties": {
    "doc_id":         {"type": "keyword"},
    "file":           {"type": "keyword"},
    "caption":        {"type": "text"},
    "image_vector":   {"type": "dense_vector", "dims": 768, "index": true, "similarity": "cosine"},
    "caption_vector": {"type": "dense_vector", "dims": 768, "index": true, "similarity": "cosine"}
  }}
}
JSON

echo "==> index 'pmc-unstructured' (1024-d bbq_hnsw + DLS markings)"
curl -sS "${H[@]}" -X DELETE "$ES/pmc-unstructured" >/dev/null 2>&1 || true
curl -sS "${H[@]}" -X PUT "$ES/pmc-unstructured" -d @- <<'JSON' >/dev/null
{
  "settings": {"index.number_of_shards": 1, "index.number_of_replicas": 0},
  "mappings": {"properties": {
    "parent_id":          {"type": "keyword"},
    "doc_title":          {"type": "text", "fields": {"raw": {"type": "keyword"}}},
    "journal":            {"type": "keyword"},
    "subject":            {"type": "keyword"},
    "year":               {"type": "integer"},
    "license_code":       {"type": "keyword"},
    "doc_type":           {"type": "keyword"},
    "language":           {"type": "keyword"},
    "source":             {"type": "keyword"},
    "chunk_type":         {"type": "keyword"},
    "chunk_ordinal":      {"type": "integer"},
    "page":               {"type": "integer"},
    "section":            {"type": "keyword"},
    "content":            {"type": "text"},
    "media_path":         {"type": "keyword"},
    "classification":     {"type": "keyword"},
    "compartments":       {"type": "keyword"},
    "compartments_count": {"type": "integer"},
    "caveats":            {"type": "keyword"},
    "releasability":      {"type": "keyword"},
    "source_type":        {"type": "keyword"},
    "embedding": {"type": "dense_vector", "dims": 1024, "index": true,
                  "similarity": "cosine", "index_options": {"type": "bbq_hnsw"}}
  }}
}
JSON

echo
echo "✅ indices ready. Next: ingest-multimodal.py and ingest-pmc.py"
curl -sS "${AUTH[@]}" "$ES/_cat/indices/jina-multimodal,pmc-unstructured?v"
