# DDIL Demo: "Vineyard Intelligence" — Implementation Plan

> **Concept:** A two-act demo using precision viticulture as the narrative. Act 1 races GPU vs CPU vector indexing on the **same DGX Spark node** to show cuVS acceleration. Act 2 uses the indexed data plus live sensor feeds to demonstrate Elastic's context engineering capabilities — all running from a Pelican case, completely airgapped.

---

## The Narrative: "Vineyard Intelligence"

A vineyard operation has deployed drones, soil sensors, and field teams to monitor crop health. They've accumulated **9 years of historical soil data, 15K+ disease images, nutrient profiles, harvest quality records, and LiDAR surveys** — totaling **615K+ vectors**. Now, deploying to a remote vineyard with no connectivity, they need to index everything at the edge and start getting answers immediately.

The DDIL kit has **live sensor hardware** (RS485 Modbus soil probes, NPK sensors, drone avionics) that write real-time readings alongside historical baselines — same index, instant comparison.

**Why vineyards?** Universal appeal (everyone likes wine), visually rich data (drone imagery, LiDAR, leaf photos), legitimate edge AI use case, and we have the actual sensor hardware to make it real.

---

## Act 1: "The Indexing Race" — GPU vs CPU on DGX Spark

### Architecture: Same Node, Two ES Instances

> **Critical:** Both ES instances run on the **DGX Spark** (192.168.1.20). The comparison is GPU-accelerated HNSW vs standard CPU HNSW on identical hardware. The Framework Desktop has no GPU and plays no role in the indexing race.

Since `vectors.indexing.use_gpu` is a **node-level** setting (not per-index), we run two ES instances on the DGX Spark:

| Instance | Port | Setting | Role |
|----------|------|---------|------|
| ES GPU | 9200 | `vectors.indexing.use_gpu: true` | GPU-accelerated HNSW graph construction |
| ES CPU | 9201 | `vectors.indexing.use_gpu: false` | Standard CPU HNSW (same hardware) |

Both instances index the **same 615K+ pre-embedded vectors** into identically-configured indices. The only variable is GPU acceleration.

### What the Audience Sees

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VINEYARD INTELLIGENCE — Indexing Race                     │
│                         DGX Spark · Blackwell GPU · 1 PFLOP                │
├────────────────────────────────┬────────────────────────────────────────────┤
│                                │                                            │
│  ◯ CPU HNSW                   │  ◉ GPU HNSW (cuVS)                         │
│  Same DGX Spark · Port 9201   │  Same DGX Spark · Port 9200                │
│  Standard graph construction   │  CUDA-accelerated graph construction       │
│                                │                                            │
│  ████████████░░░░░░░░  58%    │  ████████████████████  100% ✓              │
│  358K / 615K vectors          │  615K / 615K vectors                        │
│                                │                                            │
│  ┌──────────────────────────┐ │  ┌──────────────────────────────────────┐  │
│  │  Throughput: 4,200 v/s   │ │  │  Throughput: 28,500 v/s              │  │
│  │  Merge Time: 340ms       │ │  │  Merge Time: 48ms                    │  │
│  │  CPU: 94%                │ │  │  GPU Util: 78%                       │  │
│  └──────────────────────────┘ │  └──────────────────────────────────────┘  │
│                                │                                            │
│  [live throughput sparkline]   │  [live throughput sparkline]                │
│                                │                                            │
├────────────────────────────────┴────────────────────────────────────────────┤
│                                                                             │
│  Speedup: 6.8x  │  Time Saved: 2m 14s  │  Same Recall: 98.7% vs 98.9%    │
│                                                                             │
│  Dataset: 500K soil readings (8-dim) + 100K environmental (6-dim)          │
│           + 15K disease image embeddings (768-dim)                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Visual Elements

1. **Progress bars** — Animated, color-coded (amber=CPU, green=GPU)
2. **Real-time metrics cards** — Vectors/sec, merge time, resource utilization
3. **Live sparkline charts** — Throughput over time (GPU consistency vs CPU degradation under load)
4. **"Finish line" moment** — GPU side gets a checkmark + celebration while CPU is still grinding
5. **Summary ribbon** — Speedup multiplier, time saved, recall parity (proving quality isn't sacrificed)
6. **Dataset breakdown** — Shows the mixed-dimensionality corpus (8-dim sensor + 768-dim image vectors)

### Technical Architecture (Act 1)

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Frontend                              │
│  (Framework Desktop — 192.168.1.10:3000)                        │
│  WebSocket connection for real-time metrics                      │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend (Framework)                     │
│                   192.168.1.10:8000                              │
│                                                                  │
│  /api/race/start     — kicks off parallel indexing to both ports │
│  /api/race/status    — WebSocket: streams metrics every 500ms    │
│  /api/race/reset     — clears indices for re-run                 │
│                                                                  │
│  Reads pre-embedded JSONL from /opt/ddil/data/preprocessed/     │
│  Sends identical bulk requests to both ES instances              │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
              ┌───── DGX Spark (192.168.1.20) ─────┐
              │                                      │
              │  ┌──────────────┐ ┌──────────────┐  │
              │  │ ES Instance 1│ │ ES Instance 2│  │
              │  │ Port 9200    │ │ Port 9201    │  │
              │  │ use_gpu:true │ │ use_gpu:false│  │
              │  │              │ │              │  │
              │  │ vineyard-*   │ │ vineyard-*   │  │
              │  │ (GPU HNSW)   │ │ (CPU HNSW)   │  │
              │  └──────────────┘ └──────────────┘  │
              │                                      │
              │  Blackwell GPU (128GB unified mem)   │
              └──────────────────────────────────────┘
```

### Index Configuration (Identical on Both Instances)

Both instances use standard HNSW — the GPU transparently accelerates graph construction when `vectors.indexing.use_gpu: true` is set at the node level. No `index_options.type` change needed.

**vineyard-soil (primary race index — 500K+ vectors):**
```json
PUT vineyard-soil
{
  "settings": { "number_of_shards": 1, "number_of_replicas": 0 },
  "mappings": {
    "properties": {
      "timestamp":         { "type": "date" },
      "vineyard_id":       { "type": "keyword" },
      "block_id":          { "type": "keyword" },
      "station_id":        { "type": "keyword" },
      "location":          { "type": "geo_point" },
      "source":            { "type": "keyword" },
      "soil_moisture_pct":       { "type": "float" },
      "soil_temp_6in_c":         { "type": "float" },
      "soil_temp_12in_c":        { "type": "float" },
      "soil_temp_24in_c":        { "type": "float" },
      "electrical_conductivity":  { "type": "float" },
      "depth_cm":                { "type": "integer" },
      "reading_vector": {
        "type": "dense_vector",
        "dims": 8,
        "index": true,
        "similarity": "cosine"
      }
    }
  }
}
```

**vineyard-imagery (high-dimensional race index — 15K+ vectors):**
```json
PUT vineyard-imagery
{
  "settings": { "number_of_shards": 1, "number_of_replicas": 0 },
  "mappings": {
    "properties": {
      "timestamp":        { "type": "date" },
      "vineyard_id":      { "type": "keyword" },
      "block_id":         { "type": "keyword" },
      "source":           { "type": "keyword" },
      "location":         { "type": "geo_point" },
      "image_path":       { "type": "keyword" },
      "image_type":       { "type": "keyword" },
      "classification":   { "type": "keyword" },
      "confidence":       { "type": "float" },
      "altitude_m":       { "type": "float" },
      "description":      { "type": "text", "analyzer": "english" },
      "image_embedding": {
        "type": "dense_vector",
        "dims": 768,
        "index": true,
        "similarity": "cosine"
      }
    }
  }
}
```

### Race Corpus (from DATASET-STRATEGY.md)

| Dataset | Records | Vector Dims | Purpose |
|---------|---------|-------------|---------|
| USDA Cook Farm soil readings | 500K+ | 8 | Time-series sensor vectors |
| SoMo.ml regional soil moisture | 100K+ | 6 | Dense environmental vectors |
| Grape disease image embeddings | 15K | 768 | High-dimensional image vectors |
| **Combined** | **~615K+** | **mixed** | **GPU vs CPU race corpus** |

---

## Act 2: "Context Engineering Anywhere" — The Elastic Story

Once the GPU finishes (Act 1's "winner"), the UI transitions to demonstrate what you can **do** with all that indexed data — plus live sensor feeds.

### Scene 2A: Live Sensor Dashboard

Real-time data from the RS485 Modbus soil probes and NPK sensors writing to Elasticsearch:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VINEYARD INTELLIGENCE — Live Sensors                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Soil Probe (RS485 Modbus)          NPK Sensor (RS485 Modbus)             │
│  ┌─────────────────────────┐        ┌─────────────────────────┐           │
│  │ Moisture: 34.2%         │        │ Nitrogen:  42 mg/kg     │           │
│  │ Temp 6":  18.4°C        │        │ Phosphorus: 28 mg/kg    │           │
│  │ Temp 12": 16.1°C        │        │ Potassium:  186 mg/kg   │           │
│  │ EC:       0.42 dS/m     │        │ pH: 6.2                 │           │
│  └─────────────────────────┘        └─────────────────────────┘           │
│                                                                             │
│  Historical Context (kNN search on reading_vector):                        │
│  "Current moisture is in the bottom 5th percentile for this season         │
│   across 9 years of USDA Cook Farm data. Similar conditions in             │
│   2012 preceded a drought stress event."                                   │
│                                                                             │
│  [24-hour moisture sparkline with historical average band]                 │
│                                                                             │
│  NPK Assessment: "This block's nutrient profile is optimal for            │
│  Cabernet Sauvignon but marginal for Pinot Noir."                         │
│  (Source: Kaggle Crop Recommendation — 2,200 reference profiles)           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Scene 2B: Semantic Search Playground

Hybrid search across all vineyard indices:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Search: "blocks showing drought stress similar to 2012 conditions"        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Retrieval Strategy: [BM25] [Semantic] [●Hybrid (RRF)]                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Block B3 — Soil Station #17           Score: 0.943              │  │
│  │    Moisture: 31% (↓12% from 30-day avg), EC rising                │  │
│  │    Similar to Cook Farm Station 22, Aug 2012 (pre-drought)        │  │
│  ├─────────────────────────────────────────────────────────────────────┤  │
│  │ 2. Block B7 — Soil Station #31           Score: 0.891              │  │
│  │    Moisture: 28%, Temp anomaly at 24" depth                       │  │
│  ├─────────────────────────────────────────────────────────────────────┤  │
│  │ 3. Regional Context (SoMo.ml)            Score: 0.847              │  │
│  │    VA wine region avg moisture 20-year trend shows drying pattern  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Latency: 47ms (embed: 12ms + search: 28ms + rerank: 7ms)                │
│  Retrieved: 10 of 615K+ docs · Hybrid RRF (BM25 + kNN)                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Scene 2C: RAG Chat — "Ask the Vineyard"

Conversational RAG using Elastic retrieval + Ollama LLM (llama3.1:70b on DGX Spark):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Vineyard Intelligence — AI Agronomist                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User: "Based on current sensor readings and historical data,              │
│         what's the risk of drought stress in Block B3 this week?"          │
│                                                                             │
│  ┌─ AI Agronomist ────────────────────────────────────────────────────┐   │
│  │ Based on current readings and historical analysis:                  │   │
│  │                                                                      │   │
│  │ **Risk Level: MODERATE-HIGH**                                       │   │
│  │                                                                      │   │
│  │ Block B3 soil moisture (34.2%) is tracking below the seasonal      │   │
│  │ average. Looking at similar conditions in the Cook Farm dataset:    │   │
│  │                                                                      │   │
│  │ - 73% of similar profiles led to drought stress within 10 days     │   │
│  │ - EC trend (0.42 → 0.48 dS/m over 72hrs) suggests increasing      │   │
│  │   salt concentration from reduced water movement                    │   │
│  │                                                                      │   │
│  │ **Recommendation:** Initiate deficit irrigation in B3 within       │   │
│  │ 48 hours. Monitor B7 (similar trajectory, 2 days behind).          │   │
│  │                                                                      │   │
│  │ Sources: 4 documents retrieved (click to expand)                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Pipeline: Query → Embed → Hybrid Search → Context → LLM (llama3.1:70b)  │
│  Total: 3.8s (first token: 0.9s)                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Scene 2D: Multimodal — "Crop Health Scanner"

Image-based search using drone imagery and grape disease embeddings:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Vineyard Intelligence — Crop Health Scanner                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Upload leaf image]  or  [Select from drone survey]                       │
│                                                                             │
│  ┌──────────┐  Analysis:                                                  │
│  │          │  Classification: Black Rot (94.2% confidence)               │
│  │  [leaf]  │  Similar cases in database: 847                             │
│  │  [image] │  Affected blocks: B3, B7, C2                               │
│  │          │  Recommendation: "Apply fungicide within 48hrs..."          │
│  └──────────┘                                                             │
│                                                                             │
│  Similar Images (kNN on image_embedding):                                  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                                     │
│  │img1│ │img2│ │img3│ │img4│ │img5│  Cosine similarity: 0.89-0.96       │
│  └────┘ └────┘ └────┘ └────┘ └────┘                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Scene 2E: "The Punchline" — System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VINEYARD INTELLIGENCE — System Overview                                   │
│                                                                             │
│  Everything you just saw is running from this:                             │
│                                                                             │
│  ┌──────────────────────────────────────────────────┐                     │
│  │  [photo/render of the Pelican case + rack]       │                     │
│  │                                                   │                     │
│  │  • 1 PFLOP of AI compute (Blackwell GPU)         │                     │
│  │  • 615K vectors indexed in ~22 seconds (GPU)     │                     │
│  │  • 15K images searchable by similarity           │                     │
│  │  • Live sensor data with 9-year historical context│                    │
│  │  • Sub-second semantic search                    │                     │
│  │  • Conversational AI with source attribution     │                     │
│  │  • Zero cloud dependency                         │                     │
│  │  • Under 50 lbs, fits under an airplane seat     │                     │
│  └──────────────────────────────────────────────────┘                     │
│                                                                             │
│  "Context engineering — anywhere."                                         │
│                                                                             │
│  ┌──────────────────────────────────────────────────┐                     │
│  │  Framework Desktop      DGX Spark                 │                    │
│  │  ├ FastAPI backend      ├ ES 9.x (GPU + CPU)     │                    │
│  │  ├ React frontend       ├ Ollama (llama3.1:70b)  │                    │
│  │  ├ Ollama (embeddings)  └ cuVS (Blackwell)       │                    │
│  │  └ Sensor data ingestion                          │                    │
│  │                                                   │                     │
│  │  UniFi Express 7 · Switch Flex Mini · 8U Rack    │                     │
│  │  Pelican Air 1615                                 │                     │
│  └──────────────────────────────────────────────────┘                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Datasets

See **DATASET-STRATEGY.md** for full details on all 8 datasets, index designs, and preprocessing.

### Summary

| Tier | Dataset | Records | Use |
|------|---------|---------|-----|
| Core | USDA Cook Farm Sensor Network | 500K+ | Soil time-series baselines |
| Core | Kaggle Crop Recommendation | 2,200 | NPK → crop suitability ML |
| Core | UCI Wine Quality | 6,497 | Wine quality correlations |
| Rich | French Vineyard Yield & Quality | ~500 | Harvest outcomes |
| Rich | VineLiDAR (Zenodo) | 2.8 GB | Drone survey 3D point clouds |
| Rich | Bavarian Vineyard Precision Vit. | ~1000 | Multi-modal sensor fusion |
| Scale | SoMo.ml Global Soil Moisture | 100K+ | Regional context layer |
| Scale | Grape Disease Images | 15K+ | Image similarity search |

### Live Sensor Data (During Demo)

| Sensor | Interface | Fields | Index |
|--------|-----------|--------|-------|
| Soil Moisture/Temp Probe | RS485 Modbus | moisture, temp (3 depths), EC | vineyard-soil-live |
| NPK Sensor | RS485 Modbus | N, P, K (mg/kg) | vineyard-npk-live |
| Weather Station | Serial | temp, humidity, pressure | vineyard-weather-live |
| Drone Avionics | USB/Serial | GPS, altitude, attitude | vineyard-imagery-live |

---

## Tech Stack

### Frontend
| Component | Technology | Notes |
|-----------|-----------|-------|
| Framework | React 18 + TypeScript | |
| Build tool | Vite | Fast dev + clean builds |
| UI library | Tailwind CSS + shadcn/ui | Dark theme, polished components |
| Charts | Recharts | Real-time sparklines and gauges |
| WebSocket | native WebSocket | Real-time race metrics + sensor data |
| Animations | Framer Motion | Progress bars, transitions, celebrations |

### Backend
| Component | Technology | Notes |
|-----------|-----------|-------|
| API server | Python FastAPI | Async, WebSocket support |
| ES client | elasticsearch-py 8.17+ (async) | Official Python client |
| Embedding | Ollama API (HTTP) via httpx | nomic-embed-text for text, CLIP for images |
| LLM | Ollama API (HTTP) via httpx | llama3.1:70b on DGX Spark |
| Sensor I/O | pymodbus + pyserial | RS485 Modbus RTU for soil/NPK probes |

### Infrastructure
| Component | Location | Port |
|-----------|----------|------|
| Elasticsearch (GPU) | DGX Spark (192.168.1.20) | 9200 |
| Elasticsearch (CPU) | DGX Spark (192.168.1.20) | 9201 |
| Ollama (embeddings) | Framework (192.168.1.10) | 11434 |
| Ollama (LLM) | DGX Spark (192.168.1.20) | 11434 |
| React app | Framework (192.168.1.10) | 3000 |
| FastAPI | Framework (192.168.1.10) | 8000 |

---

## Project Structure

```
/Users/bholden/Desktop/ddil/demo/
├── frontend/                    # React app (Vite + TypeScript)
│   ├── src/
│   │   ├── components/
│   │   │   ├── RaceDashboard/   # Act 1: GPU vs CPU split-screen
│   │   │   ├── SensorDashboard/ # Act 2A: Live sensor readings
│   │   │   ├── SearchPlayground/# Act 2B: Hybrid search
│   │   │   ├── RAGChat/         # Act 2C: AI Agronomist chat
│   │   │   ├── LeafScanner/     # Act 2D: Image similarity
│   │   │   ├── SystemOverview/  # Act 2E: Punchline
│   │   │   └── shared/          # Navigation, StatusBar, etc.
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   └── useRaceMetrics.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── backend/                      # FastAPI server
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── routers/
│   │   │   ├── race.py          # /api/race/*
│   │   │   ├── search.py        # /api/search/*
│   │   │   ├── chat.py          # /api/chat/*
│   │   │   ├── images.py        # /api/images/*
│   │   │   └── sensors.py       # /api/sensors/*
│   │   ├── services/
│   │   │   ├── elasticsearch.py
│   │   │   ├── indexer.py
│   │   │   ├── embedder.py
│   │   │   ├── search.py
│   │   │   ├── rag.py
│   │   │   └── metrics.py
│   │   └── models/
│   │       ├── schemas.py
│   │       └── es_mappings.py
│   ├── requirements.txt
│   └── run.sh
│
├── data/                         # Datasets
│   ├── raw/                     # Downloaded originals
│   └── preprocessed/            # JSONL aligned to index schemas
│       ├── soil-readings.jsonl
│       ├── npk-profiles.jsonl
│       ├── grape-embeddings.jsonl
│       ├── wine-quality.jsonl
│       └── harvest-outcomes.jsonl
│
└── scripts/
    ├── download-datasets.sh     # Fetch all datasets
    ├── preprocess-soil.py       # USDA Cook Farm → JSONL
    ├── preprocess-npk.py        # Kaggle NPK → JSONL
    ├── preprocess-wine.py       # UCI Wine Quality → JSONL
    ├── embed-images.py          # Grape disease → CLIP embeddings → JSONL
    ├── setup-indices.sh         # Create indices on both ES instances
    └── validate-dgx-cuvs.sh    # DGX Spark cuVS feasibility check
```

---

## Implementation Phases

### Phase 1: Infrastructure (Day 1)
- [ ] Run `validate-dgx-cuvs.sh` on DGX Spark
- [ ] Install Elasticsearch 9.x on DGX Spark (two instances: port 9200 GPU, port 9201 CPU)
- [ ] Attempt cuVS aarch64 build (see CUVS-AARCH64-BUILD.md)
- [ ] Verify GPU-accelerated index creation works
- [ ] Set up Ollama on both nodes

### Phase 2: Data Pipeline (Days 1-2)
- [ ] Download all datasets
- [ ] Preprocess USDA Cook Farm → JSONL with reading_vector
- [ ] Preprocess Kaggle NPK → JSONL with npk_vector
- [ ] Pre-compute CLIP embeddings for grape disease images
- [ ] Preprocess UCI Wine Quality, French Vineyard harvest data
- [ ] Extract VA/MD region from SoMo.ml
- [ ] Create and test index templates on both ES instances

### Phase 3: Backend API (Days 2-3)
- [ ] FastAPI skeleton with config
- [ ] ES client factory (dual-instance: GPU port + CPU port)
- [ ] Indexing service with real-time metrics collection
- [ ] WebSocket endpoint for streaming race metrics
- [ ] Search endpoints (BM25, kNN, hybrid RRF)
- [ ] RAG pipeline (retrieve → context → stream LLM response)
- [ ] Image similarity search endpoint
- [ ] Sensor data ingestion (RS485 Modbus → ES)

### Phase 4: Frontend — Act 1 (Days 3-4)
- [ ] React + Vite + Tailwind + shadcn/ui scaffold
- [ ] Navigation with scene structure
- [ ] RaceDashboard: split-screen, progress bars, metrics, sparklines
- [ ] Speedup summary ribbon
- [ ] "Race complete" celebration animation

### Phase 5: Frontend — Act 2 (Days 5-6)
- [ ] SensorDashboard: live readings + historical context
- [ ] SearchPlayground: query input, retrieval mode toggle, results
- [ ] RAGChat: streaming chat with source attribution
- [ ] LeafScanner: image upload + similarity results grid
- [ ] SystemOverview: punchline dashboard

### Phase 6: Polish & Rehearsal (Day 7)
- [ ] Dark theme refinement
- [ ] Loading states, error handling
- [ ] Pre-compute all embeddings for instant demo reset
- [ ] Presenter mode (keyboard shortcuts for scene navigation)
- [ ] Offline/airgap verification
- [ ] Timing rehearsal

---

## DGX Spark ES Dual-Instance Setup

Running two ES instances on the same DGX Spark requires separate data directories and configs:

```bash
# Instance 1: GPU-accelerated (port 9200)
# /etc/elasticsearch/es-gpu/elasticsearch.yml
cluster.name: vineyard-gpu
node.name: dgx-gpu
path.data: /var/lib/elasticsearch/gpu
path.logs: /var/log/elasticsearch/gpu
network.host: 0.0.0.0
http.port: 9200
transport.port: 9300
vectors.indexing.use_gpu: true

# Instance 2: CPU-only (port 9201)
# /etc/elasticsearch/es-cpu/elasticsearch.yml
cluster.name: vineyard-cpu
node.name: dgx-cpu
path.data: /var/lib/elasticsearch/cpu
path.logs: /var/log/elasticsearch/cpu
network.host: 0.0.0.0
http.port: 9201
transport.port: 9301
vectors.indexing.use_gpu: false
```

Both are single-node clusters. The GPU instance needs `CUVS_JAVA_SO_PATH` set if using the aarch64 build (see CUVS-AARCH64-BUILD.md).

---

## Open Questions / Risks

1. **cuVS on aarch64:** The ES GPU plugin is x86_64-only. We have a viable build path (3 soft gates identified — see CUVS-AARCH64-BUILD.md) but it's unverified until we SSH into the DGX Spark. Validation script ready: `scripts/validate-dgx-cuvs.sh`.

2. **Blackwell sm_121 compute capability:** cuVS may not yet recognize the Blackwell GPU's compute capability. Test with `nvidia-smi` on arrival.

3. **Two ES instances on same node:** Memory management is key. DGX Spark has 128GB unified memory. Allocate ~16GB heap to each ES instance, leaving plenty for GPU operations and Ollama.

4. **Embedding pre-computation:** All 615K+ vectors should be pre-embedded before the race. The race measures **indexing** speed only, not embedding generation. Pre-compute once using Ollama on Framework Desktop.

5. **Fallback plan:** If cuVS build fails on aarch64, we can still demo the full Act 2 story (search, RAG, sensors, images) on CPU. The race could show pre-recorded GPU metrics alongside live CPU indexing with a clear disclosure.

6. **Dataset licensing:** USDA (public domain), Kaggle NPK (Apache 2.0), UCI Wine (CC BY 4.0), VineLiDAR (CC BY 4.0). All fine for demos.
