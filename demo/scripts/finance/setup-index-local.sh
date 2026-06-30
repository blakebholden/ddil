#!/usr/bin/env bash
# setup-index-local.sh — create the airgapped sec_10k_2026 index on the local
# cluster and bulk-load the locally re-embedded NDJSON (from reembed-local.py).
#
# Differs from the bench index_finance.sh only in the vector dims/similarity:
# the local index matches the kit's embedder (nomic-embed-text, 768-d) instead
# of Bedrock Cohere v4 (1536-d). The ES|QL agent tools use BM25 MATCH and don't
# care about dims; only the kNN search path (Chapter 03) does.
#
# Usage:
#   ES_URL=http://192.168.1.20:9200 DIMS=768 bash setup-index-local.sh ./sec_10k_local.ndjson
set -euo pipefail

ES="${ES_URL:-http://192.168.1.20:9200}"     # local GPU node (DGX Spark) by default
INDEX="${INDEX:-sec_10k_2026}"
DIMS="${DIMS:-768}"                          # nomic-embed-text
SIM="${SIM:-cosine}"                         # nomic vectors aren't unit-norm → cosine
SRC="${1:-./sec_10k_local.ndjson}"
AUTH=()
if [ -n "${ES_USER:-}" ] && [ -n "${ES_PASSWORD:-}" ]; then
  AUTH=(-u "${ES_USER}:${ES_PASSWORD}")
fi

if [ ! -s "$SRC" ]; then
  echo "missing or empty: $SRC  (run reembed-local.py first)"; exit 1
fi

echo "==> dropping any existing $INDEX on $ES"
curl -sS "${AUTH[@]}" -X DELETE "$ES/$INDEX" >/dev/null || true

echo "==> creating $INDEX (dims=$DIMS, similarity=$SIM)"
curl -sS "${AUTH[@]}" -X PUT "$ES/$INDEX" -H 'Content-Type: application/json' -d @- <<JSON
{
  "settings": { "index.number_of_shards": 1, "index.number_of_replicas": 0, "index.refresh_interval": "-1" },
  "mappings": {
    "dynamic": false,
    "properties": {
      "ticker":      { "type": "keyword" },
      "company":     { "type": "text" },
      "cik":         { "type": "keyword" },
      "sector":      { "type": "keyword" },
      "accession":   { "type": "keyword" },
      "source_url":  { "type": "keyword" },
      "chunk_idx":   { "type": "integer" },
      "text":        { "type": "text" },
      "emb": {
        "type": "dense_vector",
        "element_type": "float",
        "dims": ${DIMS},
        "index": true,
        "similarity": "${SIM}",
        "index_options": { "type": "hnsw" }
      }
    }
  }
}
JSON
echo

echo "==> bulk loading $(du -h "$SRC" | cut -f1) in 5MB chunks"
python3 - "$SRC" "$ES/$INDEX/_bulk?filter_path=took,errors" "${ES_USER:-}" "${ES_PASSWORD:-}" <<'PY'
import sys, base64, urllib.request

src, url, user, pw = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
headers = {"Content-Type": "application/x-ndjson"}
if user and pw:
    headers["Authorization"] = "Basic " + base64.b64encode(f"{user}:{pw}".encode()).decode()

TARGET = 5 * 1024 * 1024
buf, n_docs, n_ok, n_fail = b"", 0, 0, 0

def flush(b):
    global n_ok, n_fail
    if not b:
        return
    req = urllib.request.Request(url, data=b, method="POST", headers=headers)
    try:
        r = urllib.request.urlopen(req, timeout=180).read().decode()
        if '"errors":false' in r:
            n_ok += 1
        else:
            n_fail += 1
            print(f"  chunk error: {r[:300]}")
    except Exception as e:
        n_fail += 1
        print(f"  chunk failed: {e}")

with open(src, "rb") as f:
    while True:
        action = f.readline()
        if not action:
            break
        doc = f.readline()
        if not doc:
            break
        buf += action + doc
        n_docs += 1
        if len(buf) >= TARGET:
            flush(buf); buf = b""
            if n_docs % 5000 == 0:
                print(f"  …loaded {n_docs} docs · ok={n_ok} fail={n_fail}")

flush(buf)
print(f"  done · {n_docs} docs · chunks ok={n_ok} fail={n_fail}")
PY

echo "==> refresh + force-merge"
curl -sS "${AUTH[@]}" -X PUT "$ES/$INDEX/_settings" -H 'Content-Type: application/json' -d '{"index.refresh_interval":"1s"}' >/dev/null
curl -sS "${AUTH[@]}" -X POST "$ES/$INDEX/_refresh" >/dev/null
curl -sS "${AUTH[@]}" -X POST "$ES/$INDEX/_forcemerge?max_num_segments=1&wait_for_completion=true" >/dev/null

echo
curl -sS "${AUTH[@]}" "$ES/_cat/indices/$INDEX?v"
