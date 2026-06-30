#!/usr/bin/env bash
# run-all.sh — end-to-end airgapped SEC data + provisioning, run ON THE BOX.
#
# Prereqs (see SEC-AIRGAP-SETUP.md):
#   • Local ES (GPU node) + Kibana up; Ollama with nomic-embed-text + gpt-oss:120b pulled
#   • The bench corpus text copied to the box: sec_10k_bulk.ndjson (or any NDJSON with `text`)
#
# Usage:
#   EP="<elastic-password>" SRC=/data/sec/sec_10k_bulk.ndjson bash run-all.sh
set -euo pipefail
cd "$(dirname "$0")"

SRC="${SRC:?set SRC to the source NDJSON (with a text field) copied onto the box}"
EP="${EP:?set EP to the elastic user password (used for Kibana + ES if security on)}"
OUT="${OUT:-./sec_10k_local.ndjson}"
OLLAMA="${OLLAMA:-http://192.168.1.20:11434}"
EMBED_MODEL="${EMBED_MODEL:-nomic-embed-text}"
export ES_URL="${ES_URL:-http://192.168.1.20:9200}"
export KB="${KB:-http://192.168.1.10:5601}"

echo "── 1/5  re-embed corpus locally ($EMBED_MODEL via $OLLAMA) ─────────────"
python3 reembed-local.py --src "$SRC" --out "$OUT" --ollama "$OLLAMA" --model "$EMBED_MODEL"

echo "── 2/5  create + bulk-load the local sec_10k_2026 index ───────────────"
DIMS="${DIMS:-768}" bash setup-index-local.sh "$OUT"

echo "── 3/5  create local Ollama LLM connector in Kibana ───────────────────"
EP="$EP" bash provision-connector-local.sh

echo "── 4/5  provision Agent Builder finance.* tools + finance-analyst ─────"
EP="$EP" bash provision-agent-local.sh

echo "── 5/5  provision Kibana data view + overview dashboard ───────────────"
EP="$EP" bash provision-kibana-local.sh

echo
echo "✅ airgapped SEC pipeline complete."
echo "   Set demo/backend/.env from .env.airgapped, then restart the backend."
echo "   Choose 'SEC Findings' in the app → Chapter 03 (search) + Chapter 04 (agent)."
