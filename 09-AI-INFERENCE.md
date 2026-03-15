# 09 - AI Inference Setup

> **Goal:** Deploy LLM inference on DGX Spark and embedding models on Framework Desktop.

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                        DGX Spark                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Ollama / vLLM                                             │ │
│  │ - Llama 3.1 70B (primary LLM)                            │ │
│  │ - Llama 3.1 8B (fast fallback)                           │ │
│  │ - Qwen 2.5 72B (alternative)                             │ │
│  └──────────────────────────────────────────────────────────┘ │
│  Port: 11434 (Ollama API)                                     │
└────────────────────────────────────────────────────────────────┘
                              │
                         Network
                              │
┌────────────────────────────────────────────────────────────────┐
│                     Framework Desktop                          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Ollama (local)                                            │ │
│  │ - e5-large-v2 (embeddings)                               │ │
│  │ - nomic-embed-text (alternative)                         │ │
│  │ - Mistral 7B (lightweight LLM)                           │ │
│  └──────────────────────────────────────────────────────────┘ │
│  Port: 11434 (local), connects to ES on 9200                  │
└────────────────────────────────────────────────────────────────┘
```

---

## Part A: DGX Spark Inference Setup

### Step 1: SSH to DGX Spark

```bash
ssh nvidia@192.168.1.20
```

### Step 2: Install Ollama on DGX

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Verify installation
ollama --version
```

### Step 3: Configure Ollama Service

```bash
# Create systemd override for network binding
sudo mkdir -p /etc/systemd/system/ollama.service.d

sudo tee /etc/systemd/system/ollama.service.d/override.conf <<EOF
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_MODELS=/home/nvidia/models"
Environment="OLLAMA_NUM_PARALLEL=4"
Environment="OLLAMA_MAX_LOADED_MODELS=2"
EOF

# Create models directory
mkdir -p /home/nvidia/models

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart ollama
sudo systemctl enable ollama
```

### Step 4: Pull Models on DGX

```bash
# Primary LLM - Llama 3.1 70B
ollama pull llama3.1:70b

# Fast fallback - Llama 3.1 8B
ollama pull llama3.1:8b

# Alternative - Qwen 2.5 72B (excellent tool calling)
ollama pull qwen2.5:72b
```

**Note:** Model downloads are large:
- llama3.1:70b → ~40GB
- llama3.1:8b → ~4.7GB
- qwen2.5:72b → ~40GB

### Step 5: Verify DGX Ollama

```bash
# Check running models
ollama list

# Test inference
ollama run llama3.1:8b "Hello, who are you?"

# Check API
curl http://localhost:11434/api/tags
```

### Step 6: Test from Framework

From Framework Desktop:

```bash
# Test DGX Ollama API
curl http://192.168.1.20:11434/api/tags

# Test generation
curl http://192.168.1.20:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "What is Elasticsearch?",
  "stream": false
}' | jq '.response'
```

---

## Part B: Framework Desktop Inference Setup

### Step 1: Install Ollama on Framework

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Verify
ollama --version
```

### Step 2: Configure Ollama for Local Use

```bash
# Create override for models location
sudo mkdir -p /etc/systemd/system/ollama.service.d

sudo tee /etc/systemd/system/ollama.service.d/override.conf <<EOF
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_MODELS=/opt/models/ollama"
EOF

# Create directory
sudo mkdir -p /opt/models/ollama
sudo chown -R $USER:$USER /opt/models

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart ollama
sudo systemctl enable ollama
```

### Step 3: Pull Embedding Models

```bash
# Primary embedding model
ollama pull nomic-embed-text

# Alternative (if needed)
ollama pull mxbai-embed-large
```

### Step 4: Pull Lightweight LLM

```bash
# For local quick inference
ollama pull mistral:7b
ollama pull phi3:mini
```

### Step 5: Verify Framework Ollama

```bash
# List models
ollama list

# Test embedding
curl http://localhost:11434/api/embeddings -d '{
  "model": "nomic-embed-text",
  "prompt": "This is a test document for embedding"
}' | jq '.embedding | length'
# Should return 768 (dimension)

# Test local LLM
ollama run mistral:7b "Summarize Elasticsearch in one sentence"
```

---

## Part C: Elasticsearch Inference Integration

### Step 1: Create Inference Endpoint for Embeddings

```bash
ELASTIC_PASSWORD=$(cat /opt/ddil/config/.es_password)

# Create inference endpoint using Ollama
curl -X PUT -u "elastic:${ELASTIC_PASSWORD}" \
  "http://localhost:9200/_inference/text_embedding/ddil-embeddings" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "ollama",
    "service_settings": {
      "host": "http://192.168.1.10:11434",
      "model": "nomic-embed-text"
    }
  }'
```

### Step 2: Create Inference Endpoint for LLM

```bash
# Create inference endpoint for completions (DGX Spark)
curl -X PUT -u "elastic:${ELASTIC_PASSWORD}" \
  "http://localhost:9200/_inference/completion/ddil-llm" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "ollama",
    "service_settings": {
      "host": "http://192.168.1.20:11434",
      "model": "llama3.1:70b"
    }
  }'
```

### Step 3: Test Inference Endpoints

```bash
# Test embedding
curl -X POST -u "elastic:${ELASTIC_PASSWORD}" \
  "http://localhost:9200/_inference/text_embedding/ddil-embeddings" \
  -H "Content-Type: application/json" \
  -d '{
    "input": ["What is semantic search?"]
  }' | jq '.embeddings[0] | length'

# Test LLM completion
curl -X POST -u "elastic:${ELASTIC_PASSWORD}" \
  "http://localhost:9200/_inference/completion/ddil-llm" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Explain what RAG means in AI"
  }' | jq '.completion'
```

---

## Part D: Model Performance Benchmarks

### Create Benchmark Script

```bash
cat > /opt/ddil/scripts/benchmark-inference.sh <<'EOF'
#!/bin/bash

echo "=== Embedding Benchmark (Framework) ==="
time curl -s http://localhost:11434/api/embeddings -d '{
  "model": "nomic-embed-text",
  "prompt": "The quick brown fox jumps over the lazy dog"
}' > /dev/null

echo ""
echo "=== LLM Benchmark - 8B (DGX) ==="
time curl -s http://192.168.1.20:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "Write a haiku about search engines",
  "stream": false
}' > /dev/null

echo ""
echo "=== LLM Benchmark - 70B (DGX) ==="
time curl -s http://192.168.1.20:11434/api/generate -d '{
  "model": "llama3.1:70b",
  "prompt": "Write a haiku about search engines",
  "stream": false
}' > /dev/null

echo ""
echo "=== LLM Benchmark - Mistral 7B (Framework) ==="
time curl -s http://localhost:11434/api/generate -d '{
  "model": "mistral:7b",
  "prompt": "Write a haiku about search engines",
  "stream": false
}' > /dev/null
EOF
chmod +x /opt/ddil/scripts/benchmark-inference.sh
```

### Run Benchmark

```bash
/opt/ddil/scripts/benchmark-inference.sh
```

### Expected Performance

| Model | Location | Tokens/sec | First Token |
|-------|----------|------------|-------------|
| nomic-embed-text | Framework | ~50 docs/s | ~20ms |
| Mistral 7B | Framework | ~30 tok/s | ~300ms |
| Llama 3.1 8B | DGX | ~120 tok/s | ~150ms |
| Llama 3.1 70B | DGX | ~40-60 tok/s | ~1s |

---

## Part E: Monitoring GPU Usage

### On DGX Spark

```bash
# Watch GPU usage
watch -n 1 nvidia-smi

# Or use nvtop (if installed)
nvtop
```

### Create Monitoring Script

```bash
cat > /opt/ddil/scripts/gpu-monitor.sh <<'EOF'
#!/bin/bash
echo "=== DGX Spark GPU Status ==="
ssh nvidia@192.168.1.20 "nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total --format=csv"
EOF
chmod +x /opt/ddil/scripts/gpu-monitor.sh
```

---

## AI Inference Setup Complete

### Verification Checklist

**DGX Spark:**
- [ ] Ollama installed and running
- [ ] Llama 3.1 70B downloaded
- [ ] Llama 3.1 8B downloaded
- [ ] API accessible from Framework

**Framework Desktop:**
- [ ] Ollama installed and running
- [ ] nomic-embed-text downloaded
- [ ] Mistral 7B downloaded
- [ ] Embedding endpoint working

**Elasticsearch:**
- [ ] Embedding inference endpoint created
- [ ] LLM inference endpoint created
- [ ] Both endpoints tested successfully

### Quick Reference

| Service | Host | Port | Models |
|---------|------|------|--------|
| DGX Ollama | 192.168.1.20 | 11434 | llama3.1:70b, 8b, qwen2.5:72b |
| Framework Ollama | 192.168.1.10 | 11434 | nomic-embed-text, mistral:7b |
| ES Embeddings | localhost | 9200 | ddil-embeddings endpoint |
| ES Completions | localhost | 9200 | ddil-llm endpoint |

### API Examples

```bash
# Generate embedding
curl http://localhost:11434/api/embeddings -d '{"model":"nomic-embed-text","prompt":"test"}'

# Generate text (DGX)
curl http://192.168.1.20:11434/api/generate -d '{"model":"llama3.1:70b","prompt":"Hello"}'

# Chat (DGX)
curl http://192.168.1.20:11434/api/chat -d '{"model":"llama3.1:70b","messages":[{"role":"user","content":"Hello"}]}'
```

---

## Next Step

Proceed to → [10-RAG-PIPELINE.md](10-RAG-PIPELINE.md)
