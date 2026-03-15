# DDIL Vineyard Intelligence Demo Kit

## Project Context

This is a portable, airgapped AI search and RAG system in a Pelican case ("DDIL Kit"). Two compute nodes, no cloud dependency.

### Hardware
- **Framework Desktop** (192.168.1.10): Ryzen AI Max+ 395, 64GB, x86_64 — runs frontend, backend, embeddings
- **DGX Spark** (192.168.1.20): GB10 Blackwell, 128GB unified memory, aarch64 — runs Elasticsearch, LLM inference, GPU vector indexing
- **Network**: UniFi Express 7 (gateway .1), Switch Flex Mini, JetKVM for remote console

### Demo Goals

**Act 1 — Indexing Race:** GPU vs CPU vector indexing on the **same DGX Spark**. Two ES 9.x instances:
- Port 9200: `vectors.indexing.use_gpu: true` (cuVS GPU-accelerated HNSW)
- Port 9201: `vectors.indexing.use_gpu: false` (standard CPU HNSW)
- Race corpus: 615K+ pre-embedded vectors (500K soil + 100K environmental + 15K disease images)
- `vectors.indexing.use_gpu` is a **node-level** setting, NOT per-index — hence two ES instances

**Act 2 — Context Engineering Anywhere:** Search, RAG, live sensors, image similarity — the full Elastic AI story running disconnected.

### cuVS on aarch64 (CRITICAL)

The ES GPU plugin (cuVS) is x86_64-only due to 3 soft gates in cuvs-java. See `CUVS-AARCH64-BUILD.md` for the full build guide. Key gates:
1. `CuVSServiceProvider.java:65` — `os.arch.equals("amd64")` check
2. `LoaderUtils.java:52` — hardcoded `linux_x64` path (bypass via `CUVS_JAVA_SO_PATH` env var)
3. `pom.xml:180` — packaging path

**First task on DGX Spark:** Run `scripts/validate-dgx-cuvs.sh` to check CUDA, compute capability, build tools.

### Tech Stack
- Frontend: React + Vite + TypeScript + Tailwind + shadcn/ui (on Framework)
- Backend: FastAPI + elasticsearch-py + httpx (on Framework)
- Search: Elasticsearch 9.x with dense_vector fields, hybrid RRF retrieval
- Embeddings: Ollama nomic-embed-text (on Framework, port 11434)
- LLM: Ollama llama3.1:70b (on DGX Spark, port 11434)
- Sensors: RS485 Modbus soil probes, NPK sensors (live data)

### Key Files
- `DEMO-PLAN.md` — Full implementation plan with wireframes
- `DATASET-STRATEGY.md` — 8 datasets, index schemas, data flow
- `CUVS-AARCH64-BUILD.md` — Step-by-step cuVS build for aarch64
- `scripts/validate-dgx-cuvs.sh` — Run this first on DGX Spark
- `demo/backend/` — FastAPI app (config points to DGX ports)
- `demo/frontend/` — React app with 7 scene components
- `demo/scripts/` — Dataset download, preprocess, index setup

### DGX Spark Tasks (Priority Order)
1. Run `scripts/validate-dgx-cuvs.sh` — assess cuVS build feasibility
2. Install Elasticsearch 9.x (two instances: port 9200 GPU, port 9201 CPU)
3. Install Ollama + pull llama3.1:70b
4. Attempt cuVS aarch64 build (see CUVS-AARCH64-BUILD.md)
5. Run `demo/scripts/setup-indices.sh` to create index templates
