# DDIL Demo Kit · Sovereign AI

## Project Context

Portable, airgapped AI search and RAG system in a Pelican Air 1615 case ("DDIL Kit"). Two compute nodes, no cloud dependency. The kit is a **multi-demo appliance** — the public/messaging brand on the kiosk display is "Sovereign AI · Context Engineering Anywhere"; individual demos (e.g. the Vineyard Intelligence agronomist below) plug in as runtimes.

### Hardware
- **DGX Spark** (192.168.1.20): GB10 Blackwell, 128GB unified memory, aarch64 — ES GPU node, LLM inference, cuVS acceleration
- **Framework Desktop** (192.168.1.10): Ryzen AI Max+ 395, 64GB, x86_64 — ES CPU node, Kibana, app frontend/backend (all Docker), **and the kiosk display**
- **Touchscreen** (HDMI from Framework): DeskPi 7.84″ 1280×400 TFT in a 2U rack mount. **Reports a fake "RTK FHD" 1920×1080 EDID** — Linux/`xrandr` can force the real 1280×400 modeline; macOS cannot easily, so dev/QA on Mac uses Chrome DevTools at 1280×400.
- **Network**: UniFi Express 7 (gateway .1), Switch Flex Mini, 1Gbps Cat6a, JetKVM for remote console

### Demo Flow (5-10 minute timed, repeatable)

1. **Adventure Chooser** — "Choose Your Adventure": Vineyard Intelligence (ready) or SEC Findings (TBD)
2. **Architecture Overview** — System diagram: 2 nodes, hardware specs, Elastic AI data flow
3. **Race Intro** — Explains datasets (841K soil, 17K imagery, 10K NPK), GPU vs CPU comparison
4. **Indexing Race** — 60-second staged race: GPU (cuVS/Blackwell) finishes in ~15s at 28,500 v/s, CPU grinds to ~55s at 4,200 v/s. Explainer appears mid-race. Auto-starts from intro.
5. **Main App** — Dashboard → Vineyard Map → AI Agronomist → Search. Everything clickable → triggers agent investigation.
6. **Reset Demo** button in sidebar returns to Adventure Chooser

---

## Architecture

### One ES Cluster: `ddil-vineyard`

Single Elasticsearch 9.3.1 cluster spanning both machines (mixed aarch64 + x86_64).

| Node | Host | Arch | Role | Custom |
|------|------|------|------|--------|
| `spark-gpu` | 192.168.1.20:9200 | aarch64 | Data node, GPU | cuVS JAR (aarch64 build) |
| `framework-cpu` | 192.168.1.10:9200 | x86_64 | Data node, CPU | Stock ES |

- Cluster discovery via `discovery.seed_hosts` pointing at each other's :9300
- `cluster.initial_master_nodes: spark-gpu,framework-cpu`
- `network.publish_host` set on both for cross-Docker visibility
- Node attribute `node.attr.accel: gpu|cpu` for shard allocation filtering

### Elasticsearch Indices

**App indices** (no allocation filtering):

| Index | Docs | Size | Key Fields |
|-------|------|------|------------|
| `vineyard-soil` | 841,536 | 148MB | soil_moisture_pct, soil_temp_6in_c, electrical_conductivity, reading_vector (8-dim), block_id, timestamp |
| `vineyard-imagery` | 17,151 | 179MB | classification, image_embedding (2048-dim), block_id, timestamp |
| `vineyard-npk` | 10,032 | 1.6MB | soil_nitrogen_mgkg, soil_phosphorus_mgkg, soil_potassium_mgkg, ph, npk_vector (7-dim) |
| `vineyard-harvest` | 175 | 34KB | grape_mass_kg, sugar_brix, quality_score, variety, vintage_year |
| `vineyard-wine` | 106 | 34KB | alcohol, volatile_acidity, quality, variety, vintage_year |

**Race indices** (allocation-filtered via `index.routing.allocation.require.accel`):

| Index | Pinned To | Purpose |
|-------|-----------|---------|
| `race-soil-gpu` | spark-gpu | GPU side of race |
| `race-soil-cpu` | framework-cpu | CPU side of race |
| `race-npk-gpu/cpu` | respective | NPK race pair |
| `race-imagery-gpu/cpu` | respective | Imagery race pair |

### Inference Endpoints (registered in ES)

```
PUT _inference/text_embedding/ollama-embeddings
  → Ollama Jina v4 at 192.168.1.20:11434/v1/embeddings (2048 dims)

PUT _inference/chat_completion/ollama-chat
  → Ollama GPT-OSS 120B at 192.168.1.20:11434/v1/chat/completions
```

### Elastic Agent Builder (Kibana)

**LLM Connector**: `Ollama GPT-OSS 120B` (.gen-ai, OpenAI-compatible → DGX :11434)

**Custom Tools** (ES|QL):
- `vineyard-sensor-snapshot` — Latest soil readings for a block
- `vineyard-npk-profile` — Latest NPK nutrient readings
- `vineyard-npk-trend` — Quarterly K/N/pH trends (detects potassium cliff)
- `vineyard-harvest-history` — Vintage yield/quality by year
- `vineyard-disease-scan` — Disease classification counts from imagery

**Agent**: `vineyard-advisor` — Uses all 5 custom tools + platform.core.search + platform.core.execute_esql

### Ollama (native on DGX Spark, port 11434)
- `gpt-oss:120b` — 65GB MXFP4, ~45 tok/s (chat completion)
- `hf.co/jinaai/jina-embeddings-v4-text-retrieval-GGUF:Q8_0` — 4.6GB (text embedding, 2048 dims)

---

## Vineyard Narrative: Domaine de la Cote Cachee

Fictional 22-acre premium wine estate, Walla Walla AVA, Washington.
Center coordinates: 46.015N, 118.38W (rural farmland south of town).

### Blocks

| Block | Name | Variety | Story Role |
|-------|------|---------|------------|
| BLK-A | Les Pierres | Cabernet Sauvignon | Star performer — south-facing, loess over basalt |
| BLK-B | Clos du Vent | Syrah | Drought-vulnerable — wind-exposed ridge, shallow rocky |
| BLK-C | La Riviere | Merlot | **CRITICAL: drainage failure since mid-2022**, K crashed 210 to 50 mg/kg |
| BLK-D | Le Jardin | Chardonnay | Disease-prone — NE-facing, sandy loam, powdery mildew in wet years |
| BLK-E | Vieilles Vignes | Cabernet Franc | Old vine resilience — 35yo vines, volcanic soil, remarkably consistent |
| BLK-F | Le Plateau | Riesling | Cool climate — highest elevation (320m), limestone |

### Baked-In Stories (AI discovers these)
1. **Block C drainage failure** — mid-2022 onset, K depletion, persistent waterlogging, EC rising
2. **2020 drought** — Block B hit hardest, but best Syrah wine (concentration effect)
3. **2022 wet spring** — disease outbreak in Blocks C and D
4. **Old vine resilience** — Block E buffers all weather extremes
5. **Potassium cliff** — leading indicator in Block C NPK trend data

### Data Generation
All data from single causal model: weather to soil to NPK to disease to harvest to wine.
Generator: `python3 -m demo.datagen.generate` from `~/ddil/` directory.

- `demo/datagen/config.py` — Vineyard definition, blocks, soil types, weather events
- `demo/datagen/weather.py` — 8-year daily weather model (2018-2025)
- `demo/datagen/soil.py` — Soil moisture driven by weather + block properties
- `demo/datagen/npk.py` — NPK nutrients with K depletion story
- `demo/datagen/harvest.py` — Harvest yield/wine quality from growing season
- `demo/datagen/generate.py` — Orchestrator

Output: `demo/data/synthetic/` (JSONL files for bulk indexing).
Grape image embeddings: re-tagged from PlantVillage dataset with block/timestamp context.

---

## Deployment

### DGX Spark (192.168.1.20)

```bash
cd ~/ddil/docker
sg docker -c "docker compose up -d"   # ES GPU with cuVS
# Ollama runs native via systemd
```

Docker compose: `docker/docker-compose.yml`
- `es-gpu`: Custom ES 9.3.1 image with aarch64 cuVS JAR
  - Bind mounts: conda cuVS libs at /opt/cuvs/lib, CUDA at /usr/local/cuda/lib64
  - GPU passthrough via NVIDIA Container Toolkit
  - `vectors.indexing.use_gpu=true`

### Framework Desktop (192.168.1.10)

```bash
cd ~/demo
docker compose up -d   # ES CPU, Kibana, backend, frontend
```

Docker compose: `demo/docker-compose.yml`
- `es-cpu`: Stock ES 9.3.1 (CPU HNSW, `vectors.indexing.use_gpu=false`)
- `kibana`: 9.3.1 with encryption keys for Agent Builder/Workflows
- `backend`: FastAPI (Python 3.12, uvicorn) — proxies to Kibana Agent Builder
- `frontend`: React 19 + Vite 8 + Tailwind 4 + Leaflet

Ports:
- :3000 — Frontend (Vite dev server)
- :8000 — Backend API
- :5601 — Kibana
- :9200 — ES CPU node
- :9300 — ES transport

### Data Indexing

```bash
# From DGX Spark (has direct ES access):
bash demo/scripts/bulk-index-synthetic.sh http://localhost:9200
```

### Map Tiles
Pre-downloaded CartoDB Dark Matter tiles at `demo/data/tiles/` (zoom 14-17).
Served by backend at `/tiles/{z}/{x}/{y}.png`.

---

## Backend Architecture

### Chat Pipeline (hybrid Agent Builder + Python)
- **Phase 0 (Sensors)**: Python — direct ES query with correct field names, instant
- **Phase 1 (Historical)**: Python — kNN vector search on reading_vector + LLM analysis
- **Phase 2 (Risk)**: Python — LLM risk assessment with heartbeat streaming
- **Phase 3 (Recommendation)**: Python — variety-specific LLM recommendations
- **Phase 4 (Action Plan)**: Python — concrete task assignments from LLM
- Agent Builder called for enrichment with real ES|QL tool queries

All phases stream SSE events to frontend. Phases 2-4 run sequentially with heartbeats.

### Race (staged simulation)
- Simulates 841,536 vector indexing
- GPU path: ~28,500 v/s, completes ~15s, 48ms merge
- CPU path: ~4,200 v/s, completes ~55s, 340ms merge
- Backend: `demo/backend/app/services/indexer.py`

### Key API Endpoints
- `GET /api/vineyard/config` — Block definitions + polygons for map
- `GET /api/vineyard/blocks/{id}/summary` — Latest sensor/NPK/harvest for a block
- `GET /api/vineyard/dashboard` — Vineyard-wide KPIs
- `POST /api/chat/agent/stream` — SSE agentic pipeline
- `POST /api/race/start` — Start indexing race
- `WS /api/race/status` — WebSocket race metrics stream
- `GET /tiles/{z}/{x}/{y}.png` — Map tiles

---

## Frontend Components

| Component | Path | Purpose |
|-----------|------|---------|
| AdventureChooser | `src/components/AdventureChooser/` | Landing screen — Vineyard vs SEC |
| Architecture | `src/components/Architecture/` | System diagram + data flow |
| RaceIntro | `src/components/RaceIntro/` | Dataset explainer + GPU vs CPU comparison |
| RaceDashboard | `src/components/RaceDashboard/` | Live race with explainer panel |
| Dashboard | `src/components/Dashboard/` | Vineyard KPIs, block cards, mini Leaflet map, alerts |
| VineyardMap | `src/components/VineyardMap/` | Full Leaflet map with block polygons + detail panel |
| AgentChat | `src/components/AgentChat/` | 5-phase agent pipeline with conversation caching |
| SearchPlayground | `src/components/SearchPlayground/` | Hybrid search (BM25/semantic/RRF) |
| LeafScanner | `src/components/LeafScanner/` | Image similarity search |
| SystemOverview | `src/components/SystemOverview/` | Hardware + service status |
| **SecDeck (SEC adventure)** | `src/components/sec/` | 8-chapter SEC Findings slide deck (ported from `demo/race-demo/`); rendered when `adventure === "sec"` |
| **JinaApp (Multimodal adventure)** | `src/components/jina/` | Multimodal + DLS Need-to-Know; rendered when `adventure === "jina"`. Scenes: `MultimodalSearch` (opener), `NeedToKnow` (research papers + DLS + generative analyst) |
| **CcsApp (Edge Federation adventure)** | `src/components/ccs/` | CCS reveal: ECH cloud cluster + box remote; "Synchronise Now" expands results cloud→cloud+edge. Rendered when `adventure === "ccs"` |

### App Context (shared state)
- `selectedBlockId` — currently selected block (flows to agent chat)
- `investigateBlock(blockId, query?)` — navigates to agent with pre-filled query
- `investigate(query)` — fires agent query
- `navigateTo(scene)` — scene navigation
- `pendingQuery` — auto-consumed by AgentChat on mount
- `resetDemo()` — returns to adventure chooser, clears conversation cache

### Conversation Caching
Agent conversations cached in localStorage (`vineyard-conversations`), max 20.
Viewable from "Recent Investigations" in AgentChat initial state.

---

## Touchscreen Kiosk (Sovereign AI Shell)

The 1280×400 panel runs an **independent React app** at `demo/kiosk/` — a meta-shell for the kit, **separate from the main demo frontend**. It's the "always-on" display: branding, system health, machine telemetry, easter egg. Demos themselves run on the main tablet/PC, not here. Runs in Chromium on the touchscreen attached to the Framework, port 3100.

**Modes:**
1. **Boot Diagnostics** — animated startup probe of ES-GPU/CPU, Ollama LLM/embed, backend, sensor bus. Auto-advances to Idle.
2. **Idle** — 2-page swipe carousel.
   - *Page 1 — Branding:* Elastic ↔ DGX Spark identity flanking a centered QR (locally-generated SVG via `qrcode.react`, points to `elastic.co/geospatial`), "Sovereign AI / Context Engineering Anywhere" headline, capability ticker.
   - *Page 2 — Diagnostics:* live (mock) Framework + DGX Spark hardware cards (CPU/GPU/RAM/VRAM bars, temp, uptime, IP pills) + bottom strip (Network · WAN · Display · Console).
3. **Easter Egg — INDEXER** *(hidden)* — Elastic-themed snake game. **Triggered by tapping the Elastic horizontal logo on the Branding page 5× in 3s.** ESC to exit. Dev hotkey: `3`.

**Controls:**
- Public-facing: **MODE ▸** button (cycles Boot ↔ Idle), swipe / arrow keys / page-dot buttons within Idle.
- Dev hotkeys: `1`/`2`/`3` jump to mode; **`** toggles a debug HUD (`?debug=1` also works) showing viewport, scale, DPR, letterbox.

**Stack independence:** The kiosk has its own `package.json` and is fully self-contained. `src/lib/health.ts` has a `MOCK = true` flag — flip to `false` once the demo backend on Framework is up; endpoints are pre-wired to `192.168.1.20:9200/9201/11434` and `/api/...`.

**Layout constraint:** Designed to a fixed 1280×400 stage scaled via `useFitScale`. Don't introduce viewport-relative sizes — keep everything in pixels relative to the 3.2:1 stage. Status bar is 28px tall (`top-7` not `pt-7` — absolute children ignore padding).

**Dev (any machine):** `cd demo/kiosk && npm install && npm run dev` → http://localhost:3100. Use Chrome DevTools at 1280×400 for pixel-accurate QA.

**Deploy (Framework, headless Ubuntu):** `cd demo/kiosk && npm run build && sudo ./deploy/install.sh`. The installer creates a `ddil` user, writes two systemd units (`ddil-kiosk-server` serves `dist/` on :3100; `ddil-kiosk` runs startx + Chromium kiosk on tty7), and `kiosk-launch.sh` registers a 1280×400 xrandr modeline before launching. Full guide: `demo/kiosk/deploy/DEPLOY.md`.

---

## Config (demo/backend/app/config.py)

```
ES_MAIN_URL = http://es-cpu:9200          (Framework CPU node, local to backend container)
ES_GPU_URL = http://192.168.1.20:9200     (DGX Spark GPU node)
OLLAMA_EMBED_URL = http://192.168.1.20:11434
OLLAMA_LLM_URL = http://192.168.1.20:11434
LLM_MODEL = gpt-oss:120b
EMBED_MODEL = nomic-embed-text
DATA_DIR = /data                          (container mount from ./data/preprocessed)
```

---

## SEC Findings (Adventure 2) — wired in

The **SEC Findings** chooser card launches the full 8-chapter presenter **slide
deck** (GPU race + semantic search + agentic RAG over S&P 500 10-K filings),
adopted from the standalone `demo/race-demo/` app into the main frontend at
`demo/frontend/src/components/sec/` (entry `SecDeck.tsx`; `App.tsx` renders it
when `adventure === "sec"`; `Esc` exits).

- **Backend:** `app/routers/finance.py` → `/api/finance/{search,sectors,agent/chat,agent/state}`.
  Embedding is pluggable via `EMBED_BACKEND`: `bedrock` (Cohere v4, 1536-d, bench)
  or `ollama` (local `nomic-embed-text`, 768-d, airgapped). `boto3` is lazy.
- **No hardcoded hosts:** every Kibana link + cURL/Python host comes from
  `/api/finance/agent/state` via `components/sec/lib/financeConfig.tsx`, so the
  same deck runs on the bench or the airgapped box by swapping `.env`.
- **Airgapped data (run on box):** `demo/scripts/finance/` — `reembed-local.py`,
  `setup-index-local.sh` (768-d cosine), `provision-connector-local.sh`
  (Kibana→Ollama LLM connector), `provision-agent-local.sh`,
  `provision-kibana-local.sh`, `run-all.sh`. Env: `demo/backend/.env.airgapped`.
  Guide: `demo/scripts/finance/SEC-AIRGAP-SETUP.md`. SEC corpus is gitignored in
  `bench-aws/finance/`; copy `sec_10k_bulk.ndjson` to the box and re-embed.

## Multimodal + DLS (Adventure 3 — HPE/Jina) — wired in

The **Multimodal Intelligence** chooser card (`adventure === "jina"` →
`components/jina/JinaApp.tsx`). Two scenes:
- **Search by Image** (opener) — `jina-multimodal` index (768-d); "type words,
  get pictures" via one native ES kNN with `query_vector_builder` (ES embeds the
  query through the on-box omni inference endpoint).
- **Need-to-Know** (main) — `pmc-unstructured` index (1024-d bbq_hnsw); 509
  research papers under a fictional **document-level-security** model. Hybrid RRF
  (BM25+kNN) with a DLS pre-filter, cross-modal figure strip, and a generative
  **Research Paper Analyst** — all scoped to the selected analyst's clearance.

- **Backend:** `app/routers/jina.py` → `/api/jina/{analysts,state,multimodal/search,search,analyst/answer,figimg,pdf,image}`.
  DLS model in `app/services/jina_dls.py` (clearance hierarchy U<CUI<C<S<TS,
  4 personas, `terms_set` subset rule for compartments, NOFORN gating). Generative
  answer reuses `services/llm.py` (gpt-oss via Ollama), grounded only in
  DLS-visible passages. Embeds via the local Jina omni server (`JINA_OMNI_URL`).
- **On-box data (run on box):** `demo/scripts/jina/` — `setup-indices-local.sh`
  (both indices + ES inference endpoint + caption pipeline), `ingest-multimodal.py`,
  `ingest-pmc.py` + `markings.py` (deterministic DLS markings). Env additions in
  `demo/backend/.env.airgapped`. Guide: `demo/scripts/jina/JINA-SETUP.md`. Needs
  the Jina omni-small server running (Blackwell cu128 build) + staged data
  (`hires_chunks.jsonl`, `hires_images.jsonl`, `extracted_imgs/`, the 10 PNGs).

## Edge Federation (Adventure 4 — CCS) — wired in

The **Edge Federation** chooser card (`adventure === "ccs"` →
`components/ccs/CcsApp.tsx`). An **Elastic Cloud Hosted** cluster (stateful, in
AWS) adds the box as a **remote cluster** and runs cross-cluster search down into
it. **"Synchronise Now"** registers the remote over the uplink; results expand
cloud-only → cloud + edge (counts jump, edge rows tagged).

> Serverless can't CCS into a self-managed box (its federation is Cross-Project
> Search, Serverless↔Serverless only) — hence ECH/stateful as the coordinator.

- **Backend:** `app/routers/ccs.py` → `/api/ccs/{state,status,synchronise,disconnect,search}`.
  All calls target the ECH endpoint (`ECH_ES_URL`/`ECH_API_KEY`). `synchronise`
  does `PUT _cluster/settings` to add `cluster.remote.edge.{mode,proxy_address}`;
  `search` checks `_remote/info` and only spans `edge:field-reports` when
  registered (never throws `no_such_remote_cluster`). **Validated against a live
  ECH 9.4.2 cluster** (seeded with 40 cloud `field-reports` docs).
- **On-box/cloud data:** `demo/scripts/ccs/seed-field-reports.sh` (run against
  ECH with `ORIGIN=cloud` and the box with `ORIGIN=edge`). Setup +
  remote-cluster/trust networking: `demo/scripts/ccs/CCS-SETUP.md`. Real ECH
  creds live in the gitignored `demo/backend/.env`; `.env.airgapped` has
  placeholders only.

## TODO / Next Steps

### Enhancements
- Elastic Workflows integration (YAML-based automation, tech preview in 9.3)
- MCP server exposure for external agent access
- semantic_text fields for text-based semantic search
- Real cuVS race (not staged) once both nodes have data
- Timeline slider for historical data scrubbing
- NPK radar charts, yield trend charts
