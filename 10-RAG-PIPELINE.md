# 10 - RAG Pipeline Setup

> **Goal:** Configure vector search, ingest pipelines, and semantic search in Elasticsearch.

## Pipeline Overview

```
Documents → Ingest Pipeline → Embeddings → Vector Index → Hybrid Search → RAG
    │              │                            │                │
    │              ▼                            │                │
    │     [nomic-embed-text]                    │                │
    │     (Framework Ollama)                    │                │
    │              │                            │                │
    │              ▼                            │                │
    │     768-dim vectors                       │                │
    │              │                            │                │
    └──────────────┴────────────────────────────┘                │
                                                                 │
                   Hybrid (BM25 + kNN) ─────────────────────────┘
                                │
                                ▼
                        Context + Query
                                │
                                ▼
                        [llama3.1:70b]
                        (DGX Spark)
                                │
                                ▼
                           Response
```

---

## Step 1: Create Vector Index Template

```bash
ELASTIC_PASSWORD=$(cat /opt/ddil/config/.es_password)
ES_HOST="http://localhost:9200"

# Create index template for RAG documents
curl -X PUT -u "elastic:${ELASTIC_PASSWORD}" \
  "${ES_HOST}/_index_template/ddil-rag-template" \
  -H "Content-Type: application/json" \
  -d '{
    "index_patterns": ["ddil-docs-*"],
    "template": {
      "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "index.default_pipeline": "ddil-embedding-pipeline"
      },
      "mappings": {
        "properties": {
          "title": {
            "type": "text",
            "analyzer": "english"
          },
          "content": {
            "type": "text",
            "analyzer": "english"
          },
          "content_embedding": {
            "type": "dense_vector",
            "dims": 768,
            "index": true,
            "similarity": "cosine"
          },
          "source": {
            "type": "keyword"
          },
          "category": {
            "type": "keyword"
          },
          "timestamp": {
            "type": "date"
          },
          "metadata": {
            "type": "object",
            "enabled": false
          }
        }
      }
    }
  }'
```

---

## Step 2: Create Embedding Ingest Pipeline

```bash
# Create ingest pipeline that generates embeddings
curl -X PUT -u "elastic:${ELASTIC_PASSWORD}" \
  "${ES_HOST}/_ingest/pipeline/ddil-embedding-pipeline" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Generate embeddings for RAG documents",
    "processors": [
      {
        "inference": {
          "model_id": "ddil-embeddings",
          "input_output": {
            "input_field": "content",
            "output_field": "content_embedding"
          }
        }
      },
      {
        "set": {
          "field": "timestamp",
          "value": "{{_ingest.timestamp}}"
        }
      }
    ]
  }'
```

---

## Step 3: Create Demo Index

```bash
# Create the index
curl -X PUT -u "elastic:${ELASTIC_PASSWORD}" \
  "${ES_HOST}/ddil-docs-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0
    }
  }'
```

---

## Step 4: Ingest Sample Documents

Create sample data script:

```bash
cat > /opt/ddil/scripts/ingest-sample-docs.sh <<'EOF'
#!/bin/bash
set -e

ELASTIC_PASSWORD=$(cat /opt/ddil/config/.es_password)
ES_HOST="http://localhost:9200"
INDEX="ddil-docs-demo"

echo "Ingesting sample documents..."

# Document 1: Elasticsearch overview
curl -s -X POST -u "elastic:${ELASTIC_PASSWORD}" \
  "${ES_HOST}/${INDEX}/_doc" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Introduction to Elasticsearch",
    "content": "Elasticsearch is a distributed, RESTful search and analytics engine. It centrally stores your data for fast search, fine‑tuned relevancy, and powerful analytics that scale with ease. Elasticsearch is the heart of the Elastic Stack and provides near real-time search and analytics for all types of data.",
    "source": "elastic-docs",
    "category": "overview"
  }'

# Document 2: Vector search
curl -s -X POST -u "elastic:${ELASTIC_PASSWORD}" \
  "${ES_HOST}/${INDEX}/_doc" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Vector Search in Elasticsearch",
    "content": "Elasticsearch supports dense vector search using the dense_vector field type. You can use approximate k-nearest neighbor (kNN) search to find vectors similar to a query vector. This enables semantic search, recommendation systems, and image similarity search. The HNSW algorithm provides efficient approximate nearest neighbor search.",
    "source": "elastic-docs",
    "category": "search"
  }'

# Document 3: RAG explanation
curl -s -X POST -u "elastic:${ELASTIC_PASSWORD}" \
  "${ES_HOST}/${INDEX}/_doc" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Retrieval Augmented Generation",
    "content": "Retrieval Augmented Generation (RAG) is a technique that combines information retrieval with text generation. First, relevant documents are retrieved from a knowledge base using semantic search. Then, these documents provide context for a large language model to generate accurate, grounded responses. RAG reduces hallucination and enables up-to-date responses.",
    "source": "ai-docs",
    "category": "ai"
  }'

# Document 4: DDIL environments
curl -s -X POST -u "elastic:${ELASTIC_PASSWORD}" \
  "${ES_HOST}/${INDEX}/_doc" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "DDIL Operations",
    "content": "Disconnected, Degraded, Intermittent, and Limited (DDIL) environments present unique challenges for AI and search systems. Traditional cloud-based solutions fail without reliable connectivity. Edge computing solutions like the NVIDIA DGX Spark enable local AI inference. Combined with Elasticsearch, organizations can deploy full-featured AI search in completely airgapped environments.",
    "source": "field-ops",
    "category": "operations"
  }'

# Document 5: Security
curl -s -X POST -u "elastic:${ELASTIC_PASSWORD}" \
  "${ES_HOST}/${INDEX}/_doc" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Security in Airgapped Deployments",
    "content": "Airgapped deployments require careful security planning. All software must be pre-staged and verified. Network isolation prevents data exfiltration. Local authentication and authorization replace cloud identity providers. Elasticsearch provides role-based access control, field-level security, and audit logging for classified environments.",
    "source": "security-docs",
    "category": "security"
  }'

echo ""
echo "Waiting for indexing..."
sleep 5

# Refresh index
curl -s -X POST -u "elastic:${ELASTIC_PASSWORD}" \
  "${ES_HOST}/${INDEX}/_refresh"

# Count documents
echo ""
echo "Document count:"
curl -s -u "elastic:${ELASTIC_PASSWORD}" \
  "${ES_HOST}/${INDEX}/_count" | jq '.count'
EOF
chmod +x /opt/ddil/scripts/ingest-sample-docs.sh
```

Run ingestion:

```bash
/opt/ddil/scripts/ingest-sample-docs.sh
```

---

## Step 5: Test Semantic Search

Create search test script:

```bash
cat > /opt/ddil/scripts/test-semantic-search.sh <<'EOF'
#!/bin/bash

ELASTIC_PASSWORD=$(cat /opt/ddil/config/.es_password)
ES_HOST="http://localhost:9200"
INDEX="ddil-docs-demo"

QUERY="${1:-What is RAG and how does it work?}"

echo "Query: $QUERY"
echo ""

# Semantic search using kNN
curl -s -X POST -u "elastic:${ELASTIC_PASSWORD}" \
  "${ES_HOST}/${INDEX}/_search" \
  -H "Content-Type: application/json" \
  -d "{
    \"size\": 3,
    \"knn\": {
      \"field\": \"content_embedding\",
      \"query_vector_builder\": {
        \"text_embedding\": {
          \"model_id\": \"ddil-embeddings\",
          \"model_text\": \"${QUERY}\"
        }
      },
      \"k\": 3,
      \"num_candidates\": 10
    },
    \"_source\": [\"title\", \"content\", \"category\"]
  }" | jq '.hits.hits[] | {title: ._source.title, score: ._score, content: ._source.content[:100]}'
EOF
chmod +x /opt/ddil/scripts/test-semantic-search.sh
```

Test:

```bash
# Test semantic search
/opt/ddil/scripts/test-semantic-search.sh "How does vector search work?"
/opt/ddil/scripts/test-semantic-search.sh "What are disconnected environments?"
/opt/ddil/scripts/test-semantic-search.sh "Tell me about security"
```

---

## Step 6: Create Hybrid Search

```bash
cat > /opt/ddil/scripts/hybrid-search.sh <<'EOF'
#!/bin/bash

ELASTIC_PASSWORD=$(cat /opt/ddil/config/.es_password)
ES_HOST="http://localhost:9200"
INDEX="ddil-docs-demo"

QUERY="${1:-What is semantic search?}"

echo "Hybrid Search Query: $QUERY"
echo ""

curl -s -X POST -u "elastic:${ELASTIC_PASSWORD}" \
  "${ES_HOST}/${INDEX}/_search" \
  -H "Content-Type: application/json" \
  -d "{
    \"size\": 3,
    \"query\": {
      \"bool\": {
        \"should\": [
          {
            \"match\": {
              \"content\": {
                \"query\": \"${QUERY}\",
                \"boost\": 0.3
              }
            }
          }
        ]
      }
    },
    \"knn\": {
      \"field\": \"content_embedding\",
      \"query_vector_builder\": {
        \"text_embedding\": {
          \"model_id\": \"ddil-embeddings\",
          \"model_text\": \"${QUERY}\"
        }
      },
      \"k\": 3,
      \"num_candidates\": 10,
      \"boost\": 0.7
    },
    \"_source\": [\"title\", \"content\"]
  }" | jq '.hits.hits[] | {title: ._source.title, score: ._score}'
EOF
chmod +x /opt/ddil/scripts/hybrid-search.sh
```

---

## Step 7: Create RAG Query Script

```bash
cat > /opt/ddil/scripts/rag-query.sh <<'EOF'
#!/bin/bash

ELASTIC_PASSWORD=$(cat /opt/ddil/config/.es_password)
ES_HOST="http://localhost:9200"
DGX_HOST="http://192.168.1.20:11434"
INDEX="ddil-docs-demo"
MODEL="llama3.1:70b"

QUERY="${1:-What is RAG?}"

echo "=== RAG Query ==="
echo "Question: $QUERY"
echo ""

# Step 1: Retrieve relevant documents
echo "Retrieving context..."
CONTEXT=$(curl -s -X POST -u "elastic:${ELASTIC_PASSWORD}" \
  "${ES_HOST}/${INDEX}/_search" \
  -H "Content-Type: application/json" \
  -d "{
    \"size\": 3,
    \"knn\": {
      \"field\": \"content_embedding\",
      \"query_vector_builder\": {
        \"text_embedding\": {
          \"model_id\": \"ddil-embeddings\",
          \"model_text\": \"${QUERY}\"
        }
      },
      \"k\": 3,
      \"num_candidates\": 10
    },
    \"_source\": [\"title\", \"content\"]
  }" | jq -r '.hits.hits[]._source | "Title: \(.title)\nContent: \(.content)\n---"')

# Step 2: Build prompt with context
PROMPT="Based on the following context, answer the question. Be concise and accurate.

Context:
${CONTEXT}

Question: ${QUERY}

Answer:"

echo "Generating response..."
echo ""

# Step 3: Generate response with LLM
curl -s -X POST "${DGX_HOST}/api/generate" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"${MODEL}\",
    \"prompt\": $(echo "$PROMPT" | jq -Rs .),
    \"stream\": false
  }" | jq -r '.response'
EOF
chmod +x /opt/ddil/scripts/rag-query.sh
```

Test RAG:

```bash
/opt/ddil/scripts/rag-query.sh "What is RAG and why is it useful?"
/opt/ddil/scripts/rag-query.sh "How can I do semantic search in Elasticsearch?"
/opt/ddil/scripts/rag-query.sh "What challenges exist in DDIL environments?"
```

---

## Step 8: Performance Tuning

### Optimize kNN Settings

```bash
# Update index settings for better kNN performance
curl -X PUT -u "elastic:${ELASTIC_PASSWORD}" \
  "${ES_HOST}/ddil-docs-demo/_settings" \
  -H "Content-Type: application/json" \
  -d '{
    "index": {
      "knn": true,
      "knn.algo_param.ef_search": 100
    }
  }'
```

---

## RAG Pipeline Complete

### Verification Checklist

- [ ] Index template created
- [ ] Embedding pipeline created
- [ ] Demo index created
- [ ] Sample documents ingested
- [ ] Semantic search working
- [ ] Hybrid search working
- [ ] RAG query working end-to-end

### Quick Test Commands

```bash
# Search
/opt/ddil/scripts/test-semantic-search.sh "your query here"

# Hybrid search
/opt/ddil/scripts/hybrid-search.sh "your query here"

# Full RAG
/opt/ddil/scripts/rag-query.sh "your question here"
```

---

## Next Step

Proceed to → [11-DEMO-APP.md](11-DEMO-APP.md)
