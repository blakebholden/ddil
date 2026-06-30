# SEC Findings — Airgapped Setup (run on the box)

How to stand up the **SEC Findings** adventure fully airgapped on the DDIL kit:
local Elasticsearch + Kibana + Ollama, no Bedrock, no AWS, no internet.

The frontend deck (the 8-chapter SEC slide deck) and the backend `finance`
router are already wired into the app. This guide builds the **data + Kibana
objects** the deck queries, and points the backend at local inference.

## What changes vs. the bench

| Piece            | Bench (connected)                | Airgapped (this guide)               |
|------------------|----------------------------------|--------------------------------------|
| Query embedding  | Bedrock Cohere Embed v4 (1536-d) | Ollama `nomic-embed-text` (768-d)    |
| `sec_10k_2026`   | on AWS GPU box, 1536-d           | local GPU node (Spark), 768-d cosine |
| Agent LLM        | Bedrock Claude (Kibana connector)| Ollama `gpt-oss:120b` (Kibana connector) |
| Kibana space     | `nvidia` on AWS                  | local Kibana, `default` space        |

The corpus is **re-embedded** because Bedrock isn't reachable airgapped. The
agent's `finance.*` ES|QL tools use BM25 `MATCH`, so they're unaffected by the
dims change — only Chapter 03's kNN search needs the 768-d index.

## Prerequisites

1. **Local cluster up** (one-cluster topology): ES GPU node on `192.168.1.20:9200`,
   Kibana on `192.168.1.10:5601`. (`demo/docker-compose.yml` / `docker/`.)
2. **Ollama models pulled** on the Spark (`192.168.1.20:11434`):
   ```
   docker exec ollama ollama pull nomic-embed-text
   docker exec ollama ollama pull gpt-oss:120b
   ```
   `gpt-oss:120b` must support tool calling (it does) — Agent Builder needs it.
3. **Corpus text on the box.** Copy the chunked corpus NDJSON from the bench
   build (`bench-aws/finance/sec_10k_bulk.ndjson`, ~2.3 GB) to the box, e.g.
   `/data/sec/sec_10k_bulk.ndjson`. Only its `text` field is used; the old
   Cohere `emb` is dropped and replaced. (Alternatively re-chunk from the raw
   `filings/` `.txt` — not required.)

## Run it

One shot:
```bash
cd demo/scripts/finance
EP="<elastic-password>" SRC=/data/sec/sec_10k_bulk.ndjson bash run-all.sh
```

Or step by step:
```bash
# 1. Re-embed locally → sec_10k_local.ndjson (768-d)
python3 reembed-local.py --src /data/sec/sec_10k_bulk.ndjson --out ./sec_10k_local.ndjson \
        --ollama http://192.168.1.20:11434 --model nomic-embed-text

# 2. Create + bulk-load the 768-d index on the GPU node
DIMS=768 ES_URL=http://192.168.1.20:9200 bash setup-index-local.sh ./sec_10k_local.ndjson

# 3. Local Ollama LLM connector in Kibana (prints the connector id)
EP="<pw>" bash provision-connector-local.sh

# 4. Agent Builder finance.* tools + finance-analyst agent
EP="<pw>" bash provision-agent-local.sh

# 5. Kibana data view + overview dashboard (the deck's "In Kibana" buttons)
EP="<pw>" bash provision-kibana-local.sh
```

If ES security is on, also export `ES_USER`/`ES_PASSWORD` for steps 1–2.

## Point the backend at local

```bash
cp demo/backend/.env.airgapped demo/backend/.env
# set VINEYARD_AGENT_BUILDER_CONNECTOR_ID to the id from step 3 (default: finance-ollama-llm)
# restart the backend
```

The backend exposes the active config at `GET /api/finance/agent/state`; the
deck reads it so every Kibana deep-link and "show the call" host string is
correct for the box. Verify:
```bash
curl -s localhost:8000/api/finance/agent/state | python3 -m json.tool
# expect embed_backend=ollama, es_url=...192.168.1.20:9200, kibana_url=...192.168.1.10:5601
```

## Smoke test

```bash
# kNN search (Chapter 03)
curl -s localhost:8000/api/finance/search -H 'Content-Type: application/json' \
     -d '{"query":"AI model risk and governance","size":5}' | python3 -m json.tool
# sectors (filter chips)
curl -s localhost:8000/api/finance/sectors | python3 -m json.tool
```

Then in the app: **SEC Findings → Chapter 03** (semantic search) and
**Chapter 04** (agent chat). `Esc` exits to the chooser.

## Notes / caveats

- **Embedding consistency:** docs and queries are both embedded with raw text
  through the same Ollama model (no `search_document:`/`search_query:` prefix),
  so they share one space. If you add prefixes, add them on both sides and
  re-embed.
- **Recall:** `nomic-embed-text` (768-d) is a smaller embedder than Cohere v4.
  Retrieval is good for the demo; don't benchmark it against the bench numbers.
- **Agent tool calling:** if Agent Builder errors on tool calls, confirm the
  connector model (`gpt-oss:120b`) is tool-capable and the Ollama OpenAI-compat
  endpoint (`/v1/chat/completions`) is reachable from Kibana.
