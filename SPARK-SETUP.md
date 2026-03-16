# DGX Spark Setup Instructions

> For Claude Code running on the NVIDIA DGX Spark (aarch64, Blackwell GPU).
> This file tells the Spark-side Claude session exactly what to build.
> **Everything runs in Docker containers.**

## Hardware Context

- **Node:** NVIDIA DGX Spark (aarch64, Grace CPU + Blackwell GPU, 128GB unified memory)
- **Role:** Elasticsearch (dual instances), Ollama LLM inference, cuVS GPU indexing
- **Network:** 192.168.1.20 on DDIL-Demo Wi-Fi (UniFi Express 7)
- **Partner node:** Framework Desktop at 192.168.1.10 (runs frontend + FastAPI backend)

## Prerequisites

The DGX Spark should already have Docker and NVIDIA Container Toolkit installed. Verify:

```bash
docker --version
docker compose version
nvidia-smi
nvidia-ctk --version
```

If Docker Compose v2 isn't available, install it:
```bash
sudo apt-get update && sudo apt-get install -y docker-compose-plugin
```

## Task 1: Create docker-compose.yml

Create the project directory and compose file:

```bash
mkdir -p /opt/ddil && cd /opt/ddil
```

**File: `/opt/ddil/docker-compose.yml`**

```yaml
version: "3.9"

services:
  # ── Elasticsearch GPU Instance (port 9200) ──────────────────
  es-gpu:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.17.0
    container_name: es-gpu
    environment:
      - cluster.name=ddil-gpu
      - node.name=spark-gpu
      - discovery.type=single-node
      - xpack.security.enabled=false
      - xpack.security.http.ssl.enabled=false
      - vectors.indexing.use_gpu=true
      - "ES_JAVA_OPTS=-Xms16g -Xmx16g"
      - bootstrap.memory_lock=true
    ulimits:
      memlock:
        soft: -1
        hard: -1
      nofile:
        soft: 65536
        hard: 65536
    volumes:
      - es-gpu-data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
      - "9300:9300"
    networks:
      - ddil-net
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    restart: unless-stopped

  # ── Elasticsearch CPU Instance (port 9201) ──────────────────
  es-cpu:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.17.0
    container_name: es-cpu
    environment:
      - cluster.name=ddil-cpu
      - node.name=spark-cpu
      - discovery.type=single-node
      - xpack.security.enabled=false
      - xpack.security.http.ssl.enabled=false
      - vectors.indexing.use_gpu=false
      - "ES_JAVA_OPTS=-Xms16g -Xmx16g"
      - bootstrap.memory_lock=true
    ulimits:
      memlock:
        soft: -1
        hard: -1
      nofile:
        soft: 65536
        hard: 65536
    volumes:
      - es-cpu-data:/usr/share/elasticsearch/data
    ports:
      - "9201:9200"
      - "9301:9300"
    networks:
      - ddil-net
    restart: unless-stopped

  # ── Ollama LLM Inference (port 11434) ───────────────────────
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama
    networks:
      - ddil-net
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    restart: unless-stopped

volumes:
  es-gpu-data:
  es-cpu-data:
  ollama-data:

networks:
  ddil-net:
    driver: bridge
```

> **Note on GPU access:** The `es-gpu` container gets GPU access for cuVS. The `es-cpu` container does NOT get GPU access — this is intentional for the race demo. If the ES Docker image doesn't support cuVS natively on aarch64, remove the `deploy.resources` block from `es-gpu` and it will fall back to CPU HNSW (race still works, just no GPU speedup).

## Task 2: Start the Stack

```bash
cd /opt/ddil

# Set vm.max_map_count for Elasticsearch
sudo sysctl -w vm.max_map_count=262144
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf

# Pull images and start
docker compose pull
docker compose up -d

# Watch logs
docker compose logs -f
```

### Verify all services are healthy

```bash
# ES GPU instance
curl -s http://localhost:9200 | python3 -m json.tool

# ES CPU instance
curl -s http://localhost:9201 | python3 -m json.tool

# Ollama
curl -s http://localhost:11434/api/tags | python3 -m json.tool
```

## Task 3: Pull Ollama Models

```bash
# Main LLM for agentic pipeline
docker exec ollama ollama pull llama3.1:70b

# Embedding model (backup; primary runs on Framework)
docker exec ollama ollama pull nomic-embed-text

# Verify
docker exec ollama ollama list
```

## Task 4: Enable Enterprise License

The GPU indexing feature (`vectors.indexing.use_gpu`) and other advanced features require an Enterprise license. A license file is included in the repo at `demo/license.json`.

**Apply the enterprise license to BOTH instances:**

```bash
# GPU instance
curl -s -X PUT "http://localhost:9200/_license?acknowledge=true" \
  -H "Content-Type: application/json" \
  -d @/path/to/ddil/demo/license.json | python3 -m json.tool

# CPU instance
curl -s -X PUT "http://localhost:9201/_license?acknowledge=true" \
  -H "Content-Type: application/json" \
  -d @/path/to/ddil/demo/license.json | python3 -m json.tool
```

Verify:
```bash
curl -s "http://localhost:9200/_license" | python3 -m json.tool
# Should show "type": "enterprise" and "status": "active"
curl -s "http://localhost:9201/_license" | python3 -m json.tool
```

> **Fallback:** If the license file doesn't work, start a 30-day trial instead:
> ```bash
> curl -s -X POST "http://localhost:9200/_license/start_trial?acknowledge=true"
> curl -s -X POST "http://localhost:9201/_license/start_trial?acknowledge=true"
> ```

## Task 5: Create Elasticsearch Indices

The index mappings are defined in the repo at `demo/backend/app/models/es_mappings.py`.

Use the setup script (run from anywhere with HTTP access to ES):
```bash
cd /path/to/ddil/demo/scripts
bash setup-indices.sh
```

### Required indices (created on BOTH instances)

| Index | Vector field | Dims | Description |
|-------|-------------|------|-------------|
| vineyard-soil | reading_vector | 8 | USDA Cook Farm soil readings |
| vineyard-npk | npk_vector | 7 | Kaggle soil NPK + crop labels |
| vineyard-imagery | image_embedding | 768 | PlantVillage CLIP embeddings |
| vineyard-harvest | _(none)_ | - | UCI Wine Quality structured data |
| vineyard-wine | _(none)_ | - | Wine quality scores + chemistry |

## Task 6: Data Preprocessing & Ingestion

### Download datasets (requires internet — do BEFORE airgap)

```bash
cd /path/to/ddil/demo/scripts
bash download-datasets.sh
```

### Preprocess

```bash
python3 preprocess-soil.py      # → data/preprocessed/soil-readings.jsonl
python3 preprocess-npk.py       # → data/preprocessed/npk-readings.jsonl
python3 preprocess-wine.py      # → data/preprocessed/wine-quality.jsonl
python3 embed-images.py         # → data/preprocessed/image-embeddings.jsonl (CLIP via Ollama)
```

### Bulk ingest (both instances)

```bash
for PORT in 9200 9201; do
  for FILE in data/preprocessed/*.jsonl; do
    INDEX=$(basename "$FILE" .jsonl | sed 's/-readings//' | sed 's/-quality//' | sed 's/-embeddings//')
    curl -s -X POST "http://localhost:$PORT/vineyard-${INDEX}/_bulk" \
      -H "Content-Type: application/x-ndjson" \
      --data-binary "@$FILE"
  done
done
```

## Task 7: cuVS aarch64 in Docker (Stretch Goal)

The `vectors.indexing.use_gpu: true` setting requires the cuVS native library inside the ES container. The official ES Docker image may not include cuVS for aarch64 yet.

### Options:

**Option A — Custom Dockerfile (extend official image):**
```dockerfile
FROM docker.elastic.co/elasticsearch/elasticsearch:8.17.0
# Install cuVS native lib for aarch64
COPY cuvs-java-aarch64.so /usr/share/elasticsearch/modules/cuvs/
```

**Option B — Volume mount the built library:**
```yaml
# Add to es-gpu service in docker-compose.yml:
volumes:
  - es-gpu-data:/usr/share/elasticsearch/data
  - ./cuvs-java-aarch64.so:/usr/share/elasticsearch/modules/cuvs/libcuvs_java.so
```

### Three soft gates to check:

1. **CUDA toolkit** — needs nvcc for aarch64 (should be available in DGX base images)
2. **cuvs-java JNI** — may need recompile for aarch64 (currently x86_64 only)
3. **Elasticsearch cuVS plugin** — must match ES version

See `CUVS-AARCH64-BUILD.md` in the repo root for the full build guide.
Run `scripts/validate-dgx-cuvs.sh` to check prerequisites.

If cuVS is not available, the GPU instance falls back to CPU HNSW indexing. The race demo still works — just without the GPU speedup.

## Docker Management Commands

```bash
cd /opt/ddil

# Start everything
docker compose up -d

# Stop everything
docker compose down

# Stop and wipe data (fresh start)
docker compose down -v

# View logs
docker compose logs -f es-gpu
docker compose logs -f es-cpu
docker compose logs -f ollama

# Restart a single service
docker compose restart es-gpu

# Check resource usage
docker stats

# Shell into a container
docker exec -it es-gpu bash
docker exec -it ollama bash
```

## Verification Checklist

```bash
# All containers running
docker compose ps

# ES GPU instance
curl -s http://localhost:9200/_cluster/health | python3 -m json.tool

# ES CPU instance
curl -s http://localhost:9201/_cluster/health | python3 -m json.tool

# ES licenses active
curl -s http://localhost:9200/_license | python3 -m json.tool
curl -s http://localhost:9201/_license | python3 -m json.tool

# Ollama models loaded
docker exec ollama ollama list

# GPU visible to containers
docker exec es-gpu nvidia-smi
docker exec ollama nvidia-smi

# From Framework (192.168.1.10):
curl -s http://192.168.1.20:9200/_cluster/health
curl -s http://192.168.1.20:9201/_cluster/health
curl -s http://192.168.1.20:11434/api/tags
```

## Network Ports Summary

| Port | Service | Container | Access |
|------|---------|-----------|--------|
| 9200 | ES GPU instance | es-gpu | Framework + local |
| 9201 | ES CPU instance | es-cpu | Framework + local |
| 9300 | ES GPU transport | es-gpu | local only |
| 9301 | ES CPU transport | es-cpu | local only |
| 11434 | Ollama API | ollama | Framework + local |
| 22 | SSH | host | Framework |
