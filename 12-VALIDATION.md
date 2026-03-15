# 12 - Validation & Testing

> **Goal:** Verify all systems operational, benchmark performance, create golden snapshot.

## Pre-Validation Checklist

Ensure all previous steps completed:

- [ ] Hardware assembled and powered
- [ ] Network configured and connected
- [ ] Ubuntu installed on Framework
- [ ] Docker running
- [ ] Elasticsearch + Kibana healthy
- [ ] Ollama running on both nodes
- [ ] Models downloaded
- [ ] RAG pipeline configured
- [ ] Demo app accessible

---

## Test Suite

### Test 1: Network Connectivity

```bash
#!/bin/bash
echo "=== Network Connectivity Test ==="

echo -n "Gateway (192.168.1.1): "
ping -c 1 -W 2 192.168.1.1 > /dev/null && echo "✓ OK" || echo "✗ FAIL"

echo -n "Framework (192.168.1.10): "
ping -c 1 -W 2 192.168.1.10 > /dev/null && echo "✓ OK" || echo "✗ FAIL"

echo -n "DGX Spark (192.168.1.20): "
ping -c 1 -W 2 192.168.1.20 > /dev/null && echo "✓ OK" || echo "✗ FAIL"

echo -n "DGX SSH: "
ssh -o ConnectTimeout=5 nvidia@192.168.1.20 "echo OK" 2>/dev/null || echo "✗ FAIL"
```

### Test 2: Service Health

```bash
#!/bin/bash
echo "=== Service Health Test ==="

ELASTIC_PASSWORD=$(cat /opt/ddil/config/.es_password)

echo -n "Elasticsearch: "
curl -s -u "elastic:${ELASTIC_PASSWORD}" http://localhost:9200/_cluster/health | \
  jq -r '.status' | grep -q "green\|yellow" && echo "✓ OK" || echo "✗ FAIL"

echo -n "Kibana: "
curl -s http://localhost:5601/api/status | \
  jq -r '.status.overall.level' | grep -q "available" && echo "✓ OK" || echo "✗ FAIL"

echo -n "Ollama (Framework): "
curl -s http://localhost:11434/api/tags > /dev/null && echo "✓ OK" || echo "✗ FAIL"

echo -n "Ollama (DGX): "
curl -s http://192.168.1.20:11434/api/tags > /dev/null && echo "✓ OK" || echo "✗ FAIL"

echo -n "Demo App: "
curl -s http://localhost:8501 > /dev/null && echo "✓ OK" || echo "✗ FAIL"
```

### Test 3: Inference Performance

```bash
#!/bin/bash
echo "=== Inference Performance Test ==="

# Embedding test
echo "Embedding (nomic-embed-text):"
time curl -s http://localhost:11434/api/embeddings -d '{
  "model": "nomic-embed-text",
  "prompt": "This is a test document for measuring embedding performance."
}' > /dev/null

# Local LLM test
echo ""
echo "Local LLM (mistral:7b) - 50 tokens:"
time curl -s http://localhost:11434/api/generate -d '{
  "model": "mistral:7b",
  "prompt": "Write a brief summary of Elasticsearch.",
  "stream": false,
  "options": {"num_predict": 50}
}' > /dev/null

# DGX 8B test
echo ""
echo "DGX LLM (llama3.1:8b) - 50 tokens:"
time curl -s http://192.168.1.20:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "Write a brief summary of Elasticsearch.",
  "stream": false,
  "options": {"num_predict": 50}
}' > /dev/null

# DGX 70B test
echo ""
echo "DGX LLM (llama3.1:70b) - 50 tokens:"
time curl -s http://192.168.1.20:11434/api/generate -d '{
  "model": "llama3.1:70b",
  "prompt": "Write a brief summary of Elasticsearch.",
  "stream": false,
  "options": {"num_predict": 50}
}' > /dev/null
```

### Test 4: Search Performance

```bash
#!/bin/bash
echo "=== Search Performance Test ==="

ELASTIC_PASSWORD=$(cat /opt/ddil/config/.es_password)

# Keyword search
echo "Keyword search (BM25):"
time curl -s -u "elastic:${ELASTIC_PASSWORD}" \
  "http://localhost:9200/ddil-docs-demo/_search" \
  -H "Content-Type: application/json" \
  -d '{"query":{"match":{"content":"elasticsearch search"}}}' > /dev/null

# Vector search
echo ""
echo "Vector search (kNN):"
time curl -s -u "elastic:${ELASTIC_PASSWORD}" \
  "http://localhost:9200/ddil-docs-demo/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "knn": {
      "field": "content_embedding",
      "query_vector_builder": {
        "text_embedding": {
          "model_id": "ddil-embeddings",
          "model_text": "How does semantic search work?"
        }
      },
      "k": 5,
      "num_candidates": 20
    }
  }' > /dev/null
```

### Test 5: End-to-End RAG

```bash
#!/bin/bash
echo "=== End-to-End RAG Test ==="

echo "Testing full RAG pipeline..."
echo "Query: What is RAG?"
echo ""

START_TIME=$(date +%s.%N)

RESPONSE=$(/opt/ddil/scripts/rag-query.sh "What is RAG?" 2>/dev/null)

END_TIME=$(date +%s.%N)
DURATION=$(echo "$END_TIME - $START_TIME" | bc)

echo "$RESPONSE"
echo ""
echo "Total time: ${DURATION}s"

if [ $(echo "$DURATION < 15" | bc) -eq 1 ]; then
  echo "✓ Performance OK (< 15s)"
else
  echo "⚠ Performance slow (> 15s)"
fi
```

---

## Create Master Test Script

```bash
cat > /opt/ddil/scripts/run-all-tests.sh <<'EOF'
#!/bin/bash
set -e

echo "╔════════════════════════════════════════════╗"
echo "║     DDIL Demo Kit - Validation Suite       ║"
echo "╚════════════════════════════════════════════╝"
echo ""

PASS=0
FAIL=0

run_test() {
  echo ">>> $1"
  if $2; then
    echo "✓ PASSED"
    ((PASS++))
  else
    echo "✗ FAILED"
    ((FAIL++))
  fi
  echo ""
}

# Network tests
run_test "Gateway ping" "ping -c 1 -W 2 192.168.1.1 > /dev/null"
run_test "DGX ping" "ping -c 1 -W 2 192.168.1.20 > /dev/null"

# Service tests
ELASTIC_PASSWORD=$(cat /opt/ddil/config/.es_password)
run_test "Elasticsearch health" "curl -sf -u elastic:${ELASTIC_PASSWORD} http://localhost:9200/_cluster/health > /dev/null"
run_test "Kibana status" "curl -sf http://localhost:5601/api/status > /dev/null"
run_test "Framework Ollama" "curl -sf http://localhost:11434/api/tags > /dev/null"
run_test "DGX Ollama" "curl -sf http://192.168.1.20:11434/api/tags > /dev/null"

# Inference tests
run_test "Embedding generation" "curl -sf http://localhost:11434/api/embeddings -d '{\"model\":\"nomic-embed-text\",\"prompt\":\"test\"}' > /dev/null"
run_test "DGX inference" "curl -sf http://192.168.1.20:11434/api/generate -d '{\"model\":\"llama3.1:8b\",\"prompt\":\"hi\",\"stream\":false}' > /dev/null"

# Search test
run_test "Vector search" "curl -sf -u elastic:${ELASTIC_PASSWORD} 'http://localhost:9200/ddil-docs-demo/_search' > /dev/null"

echo "════════════════════════════════════════════"
echo "Results: ${PASS} passed, ${FAIL} failed"
echo "════════════════════════════════════════════"

if [ $FAIL -eq 0 ]; then
  echo "🎉 All tests passed!"
  exit 0
else
  echo "⚠️  Some tests failed. Check logs."
  exit 1
fi
EOF
chmod +x /opt/ddil/scripts/run-all-tests.sh
```

Run all tests:

```bash
/opt/ddil/scripts/run-all-tests.sh
```

---

## Performance Benchmarks

### Expected Results

| Metric | Target | Notes |
|--------|--------|-------|
| Cold boot to operational | < 5 min | All services up |
| Elasticsearch query (BM25) | < 50ms | Single query |
| Vector search (kNN) | < 100ms | Including embedding |
| Embedding generation | < 50ms | Single document |
| LLM first token (70B) | < 2s | DGX Spark |
| LLM generation (70B) | 40-60 tok/s | DGX Spark |
| RAG end-to-end | < 10s | Full pipeline |
| Power consumption | < 600W | Both nodes active |

---

## Create Golden Snapshot

Once validation passes, create a restore point:

```bash
#!/bin/bash
ELASTIC_PASSWORD=$(cat /opt/ddil/config/.es_password)

# Create Elasticsearch snapshot
echo "Creating Elasticsearch snapshot..."
curl -X PUT -u "elastic:${ELASTIC_PASSWORD}" \
  "http://localhost:9200/_snapshot/ddil_backup/golden_$(date +%Y%m%d)" \
  -H "Content-Type: application/json" \
  -d '{
    "indices": "*",
    "include_global_state": true
  }'

# Export Kibana saved objects
echo "Exporting Kibana objects..."
curl -X POST -u "elastic:${ELASTIC_PASSWORD}" \
  "http://localhost:5601/api/saved_objects/_export" \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -d '{"type": ["dashboard", "visualization", "index-pattern"]}' \
  > /opt/ddil/config/kibana-export-$(date +%Y%m%d).ndjson

# Backup configs
echo "Backing up configurations..."
tar czf /opt/snapshots/config-backup-$(date +%Y%m%d).tar.gz \
  /opt/ddil/config \
  /opt/ddil/docker-compose.yml \
  /opt/ddil/scripts

echo "Golden snapshot created!"
```

---

## Validation Complete

### Final Checklist

- [ ] All network connectivity tests pass
- [ ] All service health tests pass
- [ ] Inference performance meets targets
- [ ] Search performance meets targets
- [ ] RAG end-to-end works
- [ ] Golden snapshot created
- [ ] Demo app accessible and functional

### Troubleshooting

| Issue | Solution |
|-------|----------|
| ES not starting | Check logs: `docker logs ddil-elasticsearch` |
| Kibana can't connect | Verify kibana_system password |
| Ollama slow | Check GPU utilization: `nvidia-smi` |
| Network issues | Verify cables, check UniFi app |

---

## Next Step

Proceed to → [SBOM.md](SBOM.md) for Software Bill of Materials
