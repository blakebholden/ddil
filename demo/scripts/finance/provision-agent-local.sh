#!/usr/bin/env bash
# provision-agent-tools.sh — idempotently create the finance.* custom tools and
# wire the finance-analyst agent to use them. These tools compress multi-step
# lookups into single Agent Builder calls:
#
#   finance.company_disclosures   — one company's top passages on a topic (was 4–6 searches)
#   finance.compare_companies     — 2–6 companies on a shared topic, one ranked list (was N × searches)
#   finance.sector_breakdown      — distinct-filing count per sector mentioning a topic
#
# Usage:
#   EP="<elastic password>" bash provision-agent-tools.sh
#
# Real-world measurement on a 4-company comparison:
#   without custom tools : 26 LLM calls · 600K input tokens · 220s
#   with    custom tools :  3 LLM calls · 120K input tokens ·  77s

set -euo pipefail

KB="${KB:-http://192.168.1.10:5601}"
EP="${EP:?set EP to the elastic user password}"
H=(-u "elastic:$EP" -H 'Content-Type: application/json' -H 'kbn-xsrf: true')

upsert_tool() {
  local payload="$1"
  local id; id=$(python3 -c "import sys,json; print(json.loads(sys.stdin.read())['id'])" <<<"$payload")
  echo "==> tool $id"
  # delete-if-exists, then create (idempotent)
  curl -sS "${H[@]}" -X DELETE "$KB/api/agent_builder/tools/$id" >/dev/null 2>&1 || true
  curl -sS "${H[@]}" -X POST   "$KB/api/agent_builder/tools" -d "$payload" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('  · type:', d.get('type','?'), '· error:' if d.get('statusCode') else '· ok', d.get('message','') if d.get('statusCode') else '')"
}

upsert_tool '{
  "id": "finance.company_disclosures",
  "type": "esql",
  "description": "Return the top text passages from a SPECIFIC S&P 500 company 10-K filing matching a topic, in ONE call. Strongly prefer this over multiple platform.core.search calls when looking up a single company.",
  "tags": ["finance","10-k"],
  "configuration": {
    "query": "FROM sec_10k_2026 METADATA _score | WHERE ticker == ?ticker AND MATCH(text, ?topic) | SORT _score DESC | KEEP ticker, company, sector, accession, chunk_idx, text, _score | LIMIT ?top_n",
    "params": {
      "ticker": {"type":"string","description":"Exact ticker symbol, UPPERCASE (e.g. AAPL, MSFT, JPM, NVDA)."},
      "topic":  {"type":"string","description":"Natural-language description of what to find (e.g. \"AI risk and governance\")."},
      "top_n":  {"type":"integer","description":"How many top passages to return. Default 5."}
    }
  }
}'

upsert_tool '{
  "id": "finance.compare_companies",
  "type": "esql",
  "description": "Returns top passages on a SHARED topic across 2–6 tickers in ONE call. Use this for cross-company comparisons. Pass empty string \"\" for unused ticker slots.",
  "tags": ["finance","10-k","comparison"],
  "configuration": {
    "query": "FROM sec_10k_2026 METADATA _score | WHERE ticker IN ( ?t1, ?t2, ?t3, ?t4, ?t5, ?t6 ) AND MATCH(text, ?topic) | SORT ticker ASC, _score DESC | KEEP ticker, company, sector, accession, chunk_idx, text, _score | LIMIT 60",
    "params": {
      "t1":    {"type":"string","description":"First ticker (UPPERCASE). Required."},
      "t2":    {"type":"string","description":"Second ticker. Pass empty string to skip."},
      "t3":    {"type":"string","description":"Third ticker. Pass empty string to skip."},
      "t4":    {"type":"string","description":"Fourth ticker. Pass empty string to skip."},
      "t5":    {"type":"string","description":"Fifth ticker. Pass empty string to skip."},
      "t6":    {"type":"string","description":"Sixth ticker. Pass empty string to skip."},
      "topic": {"type":"string","description":"What to compare (e.g. \"AI risk\")."}
    }
  }
}'

upsert_tool '{
  "id": "finance.sector_breakdown",
  "type": "esql",
  "description": "Count distinct 10-K filings (NOT chunks) mentioning a topic, grouped by sector and sorted. Use this for sector-level prevalence questions.",
  "tags": ["finance","10-k","aggregation"],
  "configuration": {
    "query": "FROM sec_10k_2026 | WHERE MATCH(text, ?topic) | STATS filings = COUNT_DISTINCT(accession) BY sector | SORT filings DESC",
    "params": {
      "topic": {"type":"string","description":"Topic to filter on (e.g. \"artificial intelligence risk\")."}
    }
  }
}'

echo
echo "==> wire finance-analyst agent"
curl -sS "${H[@]}" -X PUT "$KB/api/agent_builder/agents/finance-analyst" -d '{
  "name": "Financial Filings Analyst",
  "description": "Analyzes SEC 10-K filings using custom finance.* tools that compress multi-step lookups into single calls.",
  "configuration": {
    "instructions": "You are a senior financial analyst specialised in SEC 10-K filings. BE EFFICIENT — minimize tool calls. NEVER exceed 6 total tool calls per question.\n\nDATA: sec_10k_2026 index. 503 latest 10-K filings, 93,541 chunks.\n\nTOOL SELECTION:\n• ONE company on ONE topic → finance.company_disclosures.\n• COMPARE 2–6 companies on a SHARED topic → finance.compare_companies. Pass empty \"\" for unused slots.\n• SECTOR PREVALENCE → finance.sector_breakdown.\n• Arbitrary aggregations → platform.core.execute_esql.\n• Broad open exploration → platform.core.search.\n\nDECISION ORDER: named ticker(s) → finance.compare/disclosures. Counts/sectors → sector_breakdown/execute_esql. Fall back to platform.core.search only if none fits.\n\nFORMAT: Markdown. **Bold** company names + key numbers. Tables for comparisons. Bullets for risk factors. ALWAYS cite ticker + accession. Never invent."
,
    "tools": [{"tool_ids": [
      "finance.company_disclosures",
      "finance.compare_companies",
      "finance.sector_breakdown",
      "platform.core.search",
      "platform.core.execute_esql",
      "platform.core.generate_esql",
      "platform.core.get_document_by_id",
      "platform.core.get_index_mapping",
      "platform.core.list_indices",
      "platform.core.index_explorer"
    ]}],
    "skill_ids": [],
    "enable_elastic_capabilities": false
  }
}' | python3 -c "import json,sys; d=json.load(sys.stdin); print('  agent:', d.get('id'), '· tools:', sum(len(t.get('tool_ids',[])) for t in d.get('configuration',{}).get('tools',[])))"
