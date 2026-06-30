# Handoff — Changes Since Last Sync

> Purpose: a change log so a session picking this up on another machine knows
> what we modified, without re-diffing. This is **not** a setup guide.

---

## 2026-06-29 — Three new adventures: SEC, HPE/Jina, CCS

The AdventureChooser now hosts **four** adventures (Vineyard + 3 new). All three
new ones are built end-to-end in code and **verified off-box** (backend imports,
per-adventure TypeScript trees clean, CCS validated against a live ES cluster).
Full per-adventure detail is in **`CLAUDE.md`** (sections "SEC Findings",
"Multimodal + DLS", "Edge Federation"). Per-demo run guides:
`demo/scripts/{finance,jina,ccs}/*-SETUP.md`.

**Frontend** — `demo/frontend/src/App.tsx` branches on `adventure` →
`components/sec/` (SecDeck), `components/jina/` (JinaApp), `components/ccs/`
(CcsApp); 4th chooser card added.
**Backend** — new routers `app/routers/{finance,jina,ccs}.py` + service
`app/services/jina_dls.py`, all registered in `main.py`; `config.py` extended
with finance/jina/ccs settings (+ fixed the `es_gpu_url` HOST/PORT bug);
`finance.py` embed is pluggable (`EMBED_BACKEND=bedrock|ollama`, boto3 lazy).

### 1. SEC Findings (`sec`)
- The standalone 8-chapter deck at `demo/race-demo/` was **adopted into the main
  app** (`components/sec/`). Hardcoded bench URLs replaced by runtime config from
  `/api/finance/agent/state` (`components/sec/lib/financeConfig.tsx`).
- Airgapped target: re-embed the SEC corpus with local `nomic-embed-text`
  (768-d). On-box: `demo/scripts/finance/run-all.sh` (+ `.env.airgapped`).
- **Still needs box:** copy `bench-aws/finance/sec_10k_bulk.ndjson` to the box,
  run the pipeline. Deck works against the AWS bench now if pointed there.

### 2. Multimodal + DLS / HPE-Jina (`jina`)
- Opener = "search images by typing" (toy 10-shape track). Main = **research-
  paper route**: 509 PMC papers under document-level security, hybrid RRF,
  cross-modal figures, + a generative **Research Paper Analyst** (gpt-oss),
  everything scoped to the analyst's clearance. DLS model in `jina_dls.py`.
- On-box: `demo/scripts/jina/` (setup-indices, ingest-pmc + markings,
  ingest-multimodal). **Still needs box:** stand up the Jina omni-small server
  (Blackwell cu128) + stage data from `~/Desktop/Jina/demo-multimodal/`.
- Caveat: markings are our own deterministic model (≈U40/CUI25/C15/S13/TS7),
  not the source demo's exact assignments.

### 3. Edge Federation / CCS (`ccs`)
- ECH (stateful, AWS) coordinating cluster adds the box as a **remote** and CCS's
  down into it. **Synchronise Now** registers the remote → results expand
  cloud→cloud+edge. **Serverless can't CCS into a self-managed box** (it only does
  Cross-Project Search) — hence ECH.
- **Validated against a LIVE ECH 9.4.2 cluster** (seeded 40 cloud `field-reports`
  docs). ECH endpoint + API key are in the **gitignored** `demo/backend/.env`
  (`.env.airgapped` has placeholders only — do not put the key there).
- **Still needs box:** make the box reachable as an ECH remote (RCS 2.0 x-cluster
  API key + proxy over the uplink — see `demo/scripts/ccs/CCS-SETUP.md`), seed
  edge docs. On-box/cloud seed: `demo/scripts/ccs/seed-field-reports.sh`.

### Not in this commit (intentionally)
- `matchvision/*` edits (unrelated project) and large untracked data dirs
  (`bench-aws/`, `demo/race-demo/`, `demo/data/`, `matchvision/preprocess/`,
  node_modules) — left in the working tree, not committed.
- `react-markdown` / `react-leaflet` install at Docker `npm ci`; this Mac's
  `node_modules` is partial so a full local `tsc -b` won't pass (per-adventure
  trees are clean).

---

**Synced to:** `github.com/holdes/ddil` (origin) · `blakebholden/ddil` retained as `upstream`
**Delta:** 2 commits on top of the last remote state (`a11acd9`) — **113 files, +5,114 / −1,156**

## Commits
- `f85167a` — Complete demo rebuild: one-cluster architecture, coherent vineyard data, containerized app
- `b37a344` — Add kiosk deploy assets, map tiles, branding, and GPU cuVS JAR

## What changed, by area

### Architecture — single ES cluster across both nodes
- `docker/docker-compose.yml` (new) + `docker/es-gpu/Dockerfile` (new) — Spark GPU ES node
- `docker/es-gpu/cuvs-java-25.12.0.jar` (new, 1.3 MB) — aarch64 cuVS build for GPU HNSW
- `demo/docker-compose.yml` — reworked to the one-cluster (`ddil-vineyard`) topology; Framework runs ES CPU node + Kibana + backend + frontend
- `scripts/ddil-startup.sh` (new) — kit bring-up; `scripts/validate-dgx-cuvs.sh` tweaked

### Data generation — new causal model (`demo/datagen/`, all new)
- `weather.py → soil.py → npk.py → harvest.py` driven by `config.py`, run via `generate.py`
- Produces the coherent vineyard dataset (Domaine de la Côte Cachée). **Output data is gitignored — regenerate or copy separately.**

### Ingest / indexing scripts (`demo/scripts/`)
- New: `bulk-index.sh`, `bulk-index-synthetic.sh`, `preprocess-harvest.py`, `race.sh`
- Reworked: `setup-indices.sh`, `preprocess-soil.py`, `embed-images.py`

### Frontend (`demo/frontend/`) — multi-adventure rebuild + containerized
- New components: `AdventureChooser`, `Architecture`, `Dashboard`, `RaceIntro`
- Major rewrites: `App.tsx`, `VineyardMap`, `AgentChat`, `RaceDashboard`
- Containerized: new `Dockerfile`, `.dockerignore`, `vite.config.ts` + `package.json` updates

### Backend (`demo/backend/`)
- New: `vineyard.py` router, `Dockerfile`, `.dockerignore`
- Updated: `main.py`, `config.py`, routers `chat.py`/`race.py`, services `indexer.py`/`metrics.py`, phase `prompts.py`

### Kiosk (`demo/kiosk/deploy/`)
- `kiosk-launch.sh` — auto-detect the panel's native mode (real EDID), fall back to the CVT modeline; cycle output to force re-handshake on the DeskPi RTK panel
- `install.sh` — `systemctl enable ddil-kiosk.service` so the kiosk autostarts

### Assets
- `branding/` (new) — Elastic logos + `deploy-splash.sh`
- `demo/data/tiles/` (new, 62 PNGs / ~316 KB) — pre-downloaded CartoDB Dark Matter tiles so the Leaflet map works offline
- `CLAUDE.md` — updated to match the rebuilt architecture

## Not in git (copy or regenerate separately)
- `demo/data/{raw,preprocessed,synthetic}` (~2.8 GB) — bulk + synthetic datasets; gitignored. Regenerate via `demo/datagen/` + `demo/scripts/`, or transfer by USB/scp.
