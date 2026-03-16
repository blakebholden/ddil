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

**Act 2 — Context Engineering Anywhere:** Agentic multi-phase advisor, search, RAG, live sensors, image similarity — the full Elastic AI story running disconnected.

### Architecture: Agentic Chat Pipeline

The AI Agronomist uses a **5-phase agentic pipeline** modeled on CanadaBuys bid analysis. Each phase streams progress via SSE (Server-Sent Events).

**Phases:**
1. **Phase 0 — Sensor Snapshot:** ES-only query for current sensor readings (no LLM)
2. **Phase 1 — Historical Context:** kNN vector search for similar past conditions + LLM pattern analysis
3. **Phase 2 — Risk Analysis:** LLM assessment of disease, moisture, nutrient, temperature risks
4. **Phase 3 — Crop Recommendation:** LLM generates prioritized management actions
5. **Phase 4 — Action Plan:** LLM creates concrete task list with assignments and deadlines

**SSE Format:** `event: <type>\ndata: <json>\n\n`
- Events: `job_start`, `phase_start`, `phase_progress`, `phase_complete`, `phase_error`, `job_complete`, `job_error`
- Endpoint: `POST /api/chat/agent/stream`

**Key backend files:**
- `demo/backend/app/services/phases/pipeline.py` — SSE orchestrator
- `demo/backend/app/services/phases/phase0_sensors.py` through `phase4_action_plan.py` — individual phase runners
- `demo/backend/app/services/phases/prompts.py` — LLM prompt templates
- `demo/backend/app/models/agent_models.py` — Pydantic models for all phases
- `demo/backend/app/services/llm.py` — Ollama LLM wrapper (`invoke_llm`, `invoke_llm_json`)

**Key frontend files:**
- `demo/frontend/src/components/AgentChat/AgentChat.tsx` — Phase card UI with live progress
- `demo/frontend/src/components/AgentChat/useAgentStream.ts` — SSE consumer hook

### cuVS on aarch64 (CRITICAL)

The ES GPU plugin (cuVS) is x86_64-only due to 3 soft gates in cuvs-java. See `CUVS-AARCH64-BUILD.md` for the full build guide. Key gates:
1. `CuVSServiceProvider.java:65` — `os.arch.equals("amd64")` check
2. `LoaderUtils.java:52` — hardcoded `linux_x64` path (bypass via `CUVS_JAVA_SO_PATH` env var)
3. `pom.xml:180` — packaging path

**First task on DGX Spark:** Run `scripts/validate-dgx-cuvs.sh` to check CUDA, compute capability, build tools.

### Tech Stack
- Frontend: React + Vite + TypeScript + Tailwind (on Framework)
- Backend: FastAPI + elasticsearch-py + httpx (on Framework)
- Search: Elasticsearch 9.x with dense_vector fields, hybrid RRF retrieval
- Embeddings: Ollama nomic-embed-text (on Framework, port 11434)
- LLM: Ollama llama3.1:70b (on DGX Spark, port 11434)
- Sensors: RS485 Modbus soil probes, NPK sensors (live data)

### Key Files
- `DEMO-PLAN.md` — Full implementation plan with wireframes
- `SPARK-SETUP.md` — **Complete DGX Spark setup instructions (START HERE on Spark)**
- `DATASET-STRATEGY.md` — 8 datasets, index schemas, data flow
- `CUVS-AARCH64-BUILD.md` — Step-by-step cuVS build for aarch64
- `scripts/validate-dgx-cuvs.sh` — Run this first on DGX Spark
- `demo/backend/` — FastAPI app (config points to DGX ports)
- `demo/frontend/` — React app with 7 scene components + AgentChat
- `demo/scripts/` — Dataset download, preprocess, index setup

### DGX Spark Tasks (Priority Order)

> **Read `SPARK-SETUP.md` first** — it has copy-pasteable commands for everything below.

1. **Install Elasticsearch 9.x** — TWO instances on the same machine:
   - `/opt/es-gpu` on port 9200 with `vectors.indexing.use_gpu: true`
   - `/opt/es-cpu` on port 9201 with `vectors.indexing.use_gpu: false`
   - Both: `discovery.type: single-node`, `xpack.security.enabled: false`
2. **Install Ollama** + pull `llama3.1:70b` — bind to `0.0.0.0:11434`
3. **Enable Enterprise license** on both ES instances (`POST /_license/start_trial?acknowledge=true`)
4. **Run `scripts/validate-dgx-cuvs.sh`** — assess cuVS build feasibility
5. **Create indices** — run `demo/scripts/setup-indices.sh` against both ES instances
6. **Download & preprocess data** — run scripts in `demo/scripts/` (requires internet, do before airgap)
7. **Bulk ingest data** — load JSONL files into both ES instances
8. **Attempt cuVS aarch64 build** (stretch goal, see `CUVS-AARCH64-BUILD.md`)
9. **Create systemd services** for ES + Ollama auto-start

### Framework Desktop Tasks
1. Frontend dev server: `cd demo/frontend && npm run dev` (port 3000)
2. Backend: `cd demo/backend && python3 -m uvicorn app.main:app --port 8001`
3. Vite proxy forwards `/api/*` to backend at `:8001`, which reaches ES/Ollama on Spark

### Config (demo/backend/app/config.py)
```
DGX_SPARK_HOST = 192.168.1.20
ES_GPU_PORT = 9200
ES_CPU_PORT = 9201
OLLAMA_EMBED_URL = http://192.168.1.10:11434  (Framework, local embeddings)
OLLAMA_LLM_URL = http://192.168.1.20:11434    (Spark, GPU inference)
LLM_MODEL = llama3.1:70b
EMBED_MODEL = nomic-embed-text
```
