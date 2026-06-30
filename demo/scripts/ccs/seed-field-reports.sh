#!/usr/bin/env bash
# seed-field-reports.sh — create + seed the `field-reports` demo index used by
# the Edge Federation (CCS) adventure. Run it TWICE:
#   • against the ECH cloud cluster  → ORIGIN=cloud (HQ analysis reports)
#   • against the DDIL box           → ORIGIN=edge  (field sensor reports)
# A federated search on ECH then spans both; "Synchronise Now" makes the edge
# docs appear (cloud N → cloud + edge).
#
# Auth: pass either API key (AK=...) or basic (EU=/EP=).
# Usage:
#   ES_URL=https://...es.aws.found.io:9243 AK=<apikey> ORIGIN=cloud N=40 bash seed-field-reports.sh
#   ES_URL=http://192.168.1.20:9200       EP=changeme  ORIGIN=edge  N=33 bash seed-field-reports.sh
set -euo pipefail

ES="${ES_URL:?set ES_URL}"
INDEX="${INDEX:-field-reports}"
ORIGIN="${ORIGIN:-cloud}"
N="${N:-40}"

AUTH=()
if [ -n "${AK:-}" ]; then
  AUTH=(-H "Authorization: ApiKey ${AK}")
elif [ -n "${EP:-}" ]; then
  AUTH=(-u "${EU:-elastic}:${EP}")
fi
H=("${AUTH[@]}" -H 'Content-Type: application/json')

echo "==> creating $INDEX on $ES"
curl -sS "${H[@]}" -X PUT "$ES/$INDEX" -d '{
  "mappings": {"properties": {
    "title":  {"type":"text"},
    "text":   {"type":"text"},
    "origin": {"type":"keyword"},
    "region": {"type":"keyword"},
    "ts":     {"type":"date"}
  }}
}' >/dev/null 2>&1 || echo "  (index may already exist)"

CLOUD_TOPICS=("quarterly threat assessment" "supply-chain risk briefing" "satellite imagery summary" "policy compliance review" "macro intelligence digest")
EDGE_TOPICS=("perimeter sensor anomaly" "RF spectrum capture" "soil/moisture field reading" "local UAV detection" "edge camera event")

echo "==> indexing $N '$ORIGIN' docs"
python3 - "$ES" "$INDEX" "$ORIGIN" "$N" "${AK:-}" "${EU:-elastic}" "${EP:-}" <<'PY'
import sys, json, base64, urllib.request, random
es, index, origin, n, ak, eu, ep = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), sys.argv[5], sys.argv[6], sys.argv[7]
headers = {"Content-Type": "application/x-ndjson"}
if ak:
    headers["Authorization"] = "ApiKey " + ak
elif ep:
    headers["Authorization"] = "Basic " + base64.b64encode(f"{eu}:{ep}".encode()).decode()

cloud = ["quarterly threat assessment","supply-chain risk briefing","satellite imagery summary","policy compliance review","macro intelligence digest"]
edge  = ["perimeter sensor anomaly","RF spectrum capture","soil/moisture field reading","local UAV detection","edge camera event"]
topics = cloud if origin == "cloud" else edge
regions = ["CONUS","EUCOM","INDOPACOM","CENTCOM"]

lines = []
for i in range(n):
    t = topics[i % len(topics)]
    doc = {
        "title": f"{t.title()} #{i+1}",
        "text": f"{origin.upper()} report on {t}. Generated at the {origin} tier for the edge-federation demo.",
        "origin": origin,
        "region": random.choice(regions),
        "ts": "2026-06-01T00:00:00Z",
    }
    lines.append(json.dumps({"index": {}}))
    lines.append(json.dumps(doc))
body = ("\n".join(lines) + "\n").encode()
req = urllib.request.Request(f"{es}/{index}/_bulk?refresh=true", data=body, method="POST", headers=headers)
resp = json.loads(urllib.request.urlopen(req, timeout=60).read())
ok = sum(1 for it in resp.get("items", []) if it.get("index", {}).get("status", 500) < 300)
print(f"  indexed {ok}/{n} '{origin}' docs into {index}")
PY

echo "✅ done. Count:"
curl -sS "${AUTH[@]}" "$ES/$INDEX/_count" 2>/dev/null
