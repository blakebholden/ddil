# DGX Spark Setup Instructions

> For Claude Code running on the NVIDIA DGX Spark (aarch64, Blackwell GPU).
> This file tells the Spark-side Claude session exactly what to build.

## Hardware Context

- **Node:** NVIDIA DGX Spark (aarch64, Grace CPU + Blackwell GPU, 128GB unified memory)
- **Role:** Elasticsearch (dual instances), Ollama LLM inference, cuVS GPU indexing
- **Network:** 192.168.1.20 on DDIL-Demo Wi-Fi (UniFi Express 7)
- **Partner node:** Framework Desktop at 192.168.1.10 (runs frontend + FastAPI backend)

## Task 1: Dual Elasticsearch Instances

We need **two** Elasticsearch instances on this machine for the GPU vs CPU indexing race demo.

### Instance 1 — GPU (port 9200)

```bash
# Download Elasticsearch 8.17+ (must have cuVS support)
wget https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.17.0-linux-aarch64.tar.gz
tar xzf elasticsearch-8.17.0-linux-aarch64.tar.gz
mv elasticsearch-8.17.0 /opt/es-gpu
```

**Config: `/opt/es-gpu/config/elasticsearch.yml`**
```yaml
cluster.name: ddil-gpu
node.name: spark-gpu
path.data: /opt/es-gpu/data
path.logs: /opt/es-gpu/logs
network.host: 0.0.0.0
http.port: 9200
transport.port: 9300
discovery.type: single-node
xpack.security.enabled: false
xpack.security.http.ssl.enabled: false

# GPU indexing — this is the key setting
vectors.indexing.use_gpu: true
```

### Instance 2 — CPU (port 9201)

```bash
cp -r /opt/es-gpu /opt/es-cpu
```

**Config: `/opt/es-cpu/config/elasticsearch.yml`**
```yaml
cluster.name: ddil-cpu
node.name: spark-cpu
path.data: /opt/es-cpu/data
path.logs: /opt/es-cpu/logs
network.host: 0.0.0.0
http.port: 9201
transport.port: 9301
discovery.type: single-node
xpack.security.enabled: false
xpack.security.http.ssl.enabled: false

# CPU-only indexing
vectors.indexing.use_gpu: false
```

### Start both instances

```bash
# GPU instance
/opt/es-gpu/bin/elasticsearch -d -p /opt/es-gpu/es-gpu.pid

# CPU instance
/opt/es-cpu/bin/elasticsearch -d -p /opt/es-cpu/es-cpu.pid
```

### Verify

```bash
curl -s http://localhost:9200 | python3 -m json.tool
curl -s http://localhost:9201 | python3 -m json.tool
```

## Task 2: Ollama Setup

Ollama handles LLM inference on the Spark's GPU.

```bash
# Install Ollama (check if already installed)
curl -fsSL https://ollama.com/install.sh | sh

# Pull required models
ollama pull llama3.1:70b       # Main LLM for agentic pipeline
ollama pull nomic-embed-text   # Embedding model (backup; primary on Framework)

# Verify
ollama list
curl -s http://localhost:11434/api/tags | python3 -m json.tool
```

**Ollama should listen on 0.0.0.0:11434** so the Framework backend can reach it:

```bash
# Edit systemd service or set env
# OLLAMA_HOST=0.0.0.0:11434
systemctl edit ollama  # or set in /etc/systemd/system/ollama.service.d/override.conf
```

Override file content:
```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

Then:
```bash
systemctl daemon-reload
systemctl restart ollama
```

## Task 3: Enable Enterprise License

The GPU indexing feature (`vectors.indexing.use_gpu`) requires an Enterprise license. Activate a trial on **both** instances:

```bash
# GPU instance — start 30-day enterprise trial
curl -s -X POST "http://localhost:9200/_license/start_trial?acknowledge=true" | python3 -m json.tool

# CPU instance — start 30-day enterprise trial
curl -s -X POST "http://localhost:9201/_license/start_trial?acknowledge=true" | python3 -m json.tool
```

Verify license status:
```bash
curl -s "http://localhost:9200/_license" | python3 -m json.tool
# Should show "type": "trial" and "status": "active"
```

> **Note:** If you have a full enterprise license key (JSON file), apply it instead:
> ```bash
> curl -s -X PUT "http://localhost:9200/_license" \
>   -H "Content-Type: application/json" \
>   -d @license.json
> ```

The trial enables all Platinum/Enterprise features including:
- `vectors.indexing.use_gpu` (cuVS GPU-accelerated HNSW)
- Machine learning inference
- Advanced security features
- Searchable snapshots

## Task 4: Create Elasticsearch Indices

Run from the Spark or the Framework (just needs HTTP access to ES).

The index mappings are defined in the repo at:
`demo/backend/app/models/es_mappings.py`

Or use the setup script:
```bash
cd /path/to/ddil/demo/scripts
bash setup-indices.sh
```

### Required indices (both GPU and CPU instances)

| Index | Vector field | Dims | Description |
|-------|-------------|------|-------------|
| vineyard-soil | reading_vector | 8 | USDA Cook Farm soil readings |
| vineyard-npk | npk_vector | 7 | Kaggle soil NPK + crop labels |
| vineyard-imagery | image_embedding | 768 | PlantVillage CLIP embeddings |
| vineyard-harvest | _(none)_ | - | UCI Wine Quality structured data |
| vineyard-wine | _(none)_ | - | Wine quality scores + chemistry |

## Task 5: Data Preprocessing & Ingestion

### Download datasets (requires internet — do before airgap)

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

## Task 6: cuVS aarch64 Build (Stretch Goal)

The `vectors.indexing.use_gpu: true` setting requires the cuVS native library.
A validation script exists at `demo/scripts/validate-dgx-cuvs.sh` (if present in repo).

### Three soft gates to check:

1. **CUDA toolkit** — needs nvcc for aarch64
2. **cuvs-java JNI** — may need recompile for aarch64 (currently x86_64 only)
3. **Elasticsearch cuVS plugin** — must match ES version

See `CUVS-AARCH64-BUILD.md` in the repo root for detailed build instructions.

If cuVS is not available, the GPU instance will still work but fall back to CPU HNSW indexing. The race demo will still function — just without the GPU speedup.

## Task 7: Systemd Services (Optional)

Create systemd units so everything starts on boot:

```bash
# /etc/systemd/system/es-gpu.service
[Unit]
Description=Elasticsearch GPU Instance
After=network.target

[Service]
Type=simple
User=elasticsearch
ExecStart=/opt/es-gpu/bin/elasticsearch
LimitNOFILE=65535
LimitMEMLOCK=infinity

[Install]
WantedBy=multi-user.target
```

Repeat for `es-cpu.service` with `/opt/es-cpu/bin/elasticsearch`.

## Verification Checklist

```bash
# ES GPU instance
curl -s http://localhost:9200/_cluster/health | python3 -m json.tool

# ES CPU instance
curl -s http://localhost:9201/_cluster/health | python3 -m json.tool

# Ollama
curl -s http://localhost:11434/api/tags | python3 -m json.tool

# From Framework (192.168.1.10):
curl -s http://192.168.1.20:9200/_cluster/health
curl -s http://192.168.1.20:11434/api/tags
```

## Network Ports Summary

| Port | Service | Access |
|------|---------|--------|
| 9200 | ES GPU instance | Framework + local |
| 9201 | ES CPU instance | Framework + local |
| 9300 | ES GPU transport | local only |
| 9301 | ES CPU transport | local only |
| 11434 | Ollama API | Framework + local |
| 22 | SSH | Framework |
