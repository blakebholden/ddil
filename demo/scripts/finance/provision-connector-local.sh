#!/usr/bin/env bash
# provision-connector-local.sh — create a Kibana gen-ai connector that points at
# the kit's LOCAL Ollama LLM (gpt-oss:120b on the DGX Spark) via Ollama's
# OpenAI-compatible API. This is the airgapped replacement for the bench's
# Bedrock connector, and is what Agent Builder uses to run the finance-analyst
# agent (Chapter 04).
#
# Requires: gpt-oss:120b pulled in Ollama and tool-calling support (it has it).
#
# Usage:
#   EP="<elastic-password>" bash provision-connector-local.sh
# Then copy the printed connector id into demo/backend/.env as
#   VINEYARD_AGENT_BUILDER_CONNECTOR_ID=...
set -euo pipefail

KB="${KB:-http://192.168.1.10:5601}"                       # local Kibana (Framework), default space
EP="${EP:?set EP to the elastic user password}"
KU="${KU:-elastic}"
CONNECTOR_ID="${CONNECTOR_ID:-finance-ollama-llm}"
OLLAMA="${OLLAMA:-http://192.168.1.20:11434}"               # DGX Spark Ollama
MODEL="${MODEL:-gpt-oss:120b}"
H=(-u "$KU:$EP" -H 'Content-Type: application/json' -H 'kbn-xsrf: true')

echo "==> creating gen-ai connector '$CONNECTOR_ID' → $OLLAMA ($MODEL)"
# delete-if-exists for idempotency, then create with a fixed id
curl -sS "${H[@]}" -X DELETE "$KB/api/actions/connector/$CONNECTOR_ID" >/dev/null 2>&1 || true
curl -sS "${H[@]}" -X POST "$KB/api/actions/connector/$CONNECTOR_ID" -d @- <<JSON | python3 -c "import json,sys; d=json.load(sys.stdin); print('  connector:', d.get('id'), '·', d.get('name')) if d.get('id') else print('  error:', d)"
{
  "name": "Local Ollama (gpt-oss)",
  "connector_type_id": ".gen-ai",
  "config": {
    "apiProvider": "Other",
    "apiUrl": "${OLLAMA}/v1/chat/completions",
    "defaultModel": "${MODEL}"
  },
  "secrets": {
    "apiKey": "ollama"
  }
}
JSON

echo
echo "Set in demo/backend/.env:"
echo "  VINEYARD_AGENT_BUILDER_CONNECTOR_ID=$CONNECTOR_ID"
