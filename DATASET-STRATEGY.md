# Vineyard Intelligence — Dataset Strategy

> **Key Insight:** This is not a static dataset demo. The DDIL kit has live sensor hardware (RS485 Modbus soil probes, NPK sensors, drone avionics). Historical datasets provide **context and baselines** that live sensor data writes alongside — same index patterns, instant comparison.

---

## Data Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Elasticsearch Index Patterns                          │
│                                                                          │
│  vineyard-soil-*        ← Live sensor readings + USDA Cook Farm history │
│  vineyard-npk-*         ← Live NPK sensor + Kaggle Crop Recommendation │
│  vineyard-weather-*     ← On-site weather + SoMo.ml regional context   │
│  vineyard-harvest-*     ← French Vineyard yield/quality outcomes        │
│  vineyard-imagery-*     ← Drone captures + VineLiDAR point clouds      │
│  vineyard-wine-*        ← UCI Wine Quality physicochemical analysis     │
│  vineyard-disease-*     ← Grape disease image embeddings               │
│                                                                          │
│  All indices share:                                                      │
│  - vineyard_id, block_id (spatial join key)                             │
│  - timestamp (temporal alignment)                                        │
│  - source: "sensor" | "historical" | "drone" | "lab"                    │
│  - geo_point for map visualizations                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Dataset Inventory

### Tier 1: Core Datasets (Must Have — Seed the Demo)

#### 1. USDA Cook Farm Sensor Network
- **Source:** USDA Ag Data Commons
- **Records:** ~42 sensor stations × hourly readings × 9 years (2007-2016)
- **Estimated volume:** 500K-1M+ time-series records
- **Fields:**
  - Soil moisture (%) at 5 depths (30, 60, 90, 120, 150 cm)
  - Soil temperature at multiple depths
  - Electrical conductivity
  - Station lat/lon
  - Timestamp
- **Maps to sensor fields:** `soil_moisture_pct`, `soil_temp_6in_c`, `soil_temp_12in_c`
- **License:** Public domain (US Government)
- **Demo value:** Historical baseline. When live sensors come online, they write to the same index — instant side-by-side of "your readings now" vs "9 years of history"
- **cuVS race value:** 500K+ records with multi-depth numerical vectors — excellent for GPU vs CPU indexing benchmark

#### 2. Kaggle Crop Recommendation Dataset
- **Source:** Kaggle (atharvaingle/crop-recommendation-dataset)
- **Records:** 2,200 instances
- **Fields:**
  - Nitrogen (N), Phosphorus (P), Potassium (K) — mg/kg
  - Temperature (°C)
  - Humidity (%)
  - pH
  - Rainfall (mm)
  - Crop label (22 classes including grapes)
- **Maps to sensor fields:** `soil_nitrogen_mgkg`, `soil_phosphorus_mgkg`, `soil_potassium_mgkg`
- **License:** Apache 2.0
- **Demo value:** "This soil NPK profile is optimal for grapes" — ML recommendation from live Modbus sensor readings. The RS485 NPK sensor feeds directly into this story.

#### 3. UCI Wine Quality (Vinho Verde)
- **Source:** UCI ML Repository
- **Records:** 6,497 (4,898 white + 1,599 red)
- **Fields:**
  - Fixed acidity, volatile acidity, citric acid
  - Residual sugar, chlorides
  - Free/total sulfur dioxide
  - Density, pH, sulphates
  - Alcohol content
  - Quality score (0-10)
- **License:** CC BY 4.0
- **Demo value:** "Soil conditions → wine quality" correlation story. Combine with NPK/soil data to show predictive relationships. Good for structured search + aggregations in Kibana.

### Tier 2: Rich Context (High Value — Differentiate the Demo)

#### 4. French Vineyard Yield & Quality Dataset
- **Source:** ScienceDirect (S2352340923007655)
- **Records:** 30-hectare commercial vineyard, harvest sectors
- **Fields:**
  - Grape mass per sector
  - Sugar content (°Brix)
  - Acidity
  - pH
  - Yeast-assimilable nitrogen (YAN)
  - GNSS coordinates per harvest sector
- **License:** Check paper
- **Demo value:** Outcome data. "These sensor conditions in this block produced this quality of grape." Closes the loop from sensing to results.

#### 5. VineLiDAR (Zenodo 8113105)
- **Source:** Zenodo (DOI: 10.5281/zenodo.8113105)
- **Size:** 2.8 GB (LAZ compressed LiDAR point clouds)
- **Location:** Tomiño, Pontevedra, Spain
- **Equipment:** DJI M300 + Zenmuse L1 LiDAR
- **Coverage:** Two vineyards, two years (2021-2022), flights at 20/30/50m AGL
- **Fields:** 3D point clouds (x, y, z) with RGB per point
- **License:** CC BY 4.0
- **Demo value:** Pairs with the drone avionics board. "Drone surveys vineyard → LiDAR data indexes into Elasticsearch → spatial queries find canopy anomalies." Shows the autonomous survey → spatial indexing pipeline.
- **cuVS race value:** Point cloud data can be vectorized for similarity search — 3D spatial features make compelling GPU acceleration story

#### 6. Bavarian Vineyard Precision Viticulture
- **Source:** MDPI
- **Fields:**
  - Diviner 2000 probe soil moisture at multiple depths
  - Daily temperature and precipitation
  - UAV multispectral data (NDVI, etc.)
  - Irrigation system comparison data
- **Demo value:** Multi-modal sensor fusion — soil probes + weather + drone imagery. Shows how the DDIL kit does the same thing at the edge.

### Tier 3: Scale & Enrichment (For the cuVS Race + Context)

#### 7. SoMo.ml Global Soil Moisture
- **Source:** Nature Scientific Data
- **Resolution:** 0.25° daily, 3 depths (0-10cm, 10-30cm, 30-50cm), 2000-2019
- **Volume:** Massive (global). Extract Virginia/Maryland wine regions.
- **Demo value:** Regional context layer. "Your vineyard's soil moisture vs. the 20-year regional average." Maps the local sensor readings against continental patterns.
- **cuVS race value:** Extracted regional subset could be 100K+ daily records — good volume for GPU benchmark.

#### 8. Grape Disease Image Datasets (from earlier research)
- **Grape Disease Dataset:** 9,027 images, 4 classes (Black Rot, ESCA, Leaf Blight, Healthy)
- **PlantVillage Grape Subset:** ~4,000 grape leaf images
- **Grapevine Leaves Dataset:** 2,500 images, 5 species
- **Demo value:** Drone captures leaf image → CLIP embedding → kNN search finds similar disease patterns in historical imagery. Pairs with VineLiDAR for the "drone survey" narrative.
- **cuVS race value:** 15K+ images × CLIP embeddings (512-768 dim) — visual, compelling side of the GPU race

---

## Index Design

### vineyard-soil (Time-Series Sensor Data)

```json
{
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

`reading_vector` = normalized [moisture, temp_6, temp_12, temp_24, EC, depth, hour_of_day, day_of_year] — enables "find similar soil conditions" via kNN.

### vineyard-npk (Nutrient Sensor Data)

```json
{
  "mappings": {
    "properties": {
      "timestamp":              { "type": "date" },
      "vineyard_id":            { "type": "keyword" },
      "block_id":               { "type": "keyword" },
      "source":                 { "type": "keyword" },
      "location":               { "type": "geo_point" },

      "soil_nitrogen_mgkg":     { "type": "float" },
      "soil_phosphorus_mgkg":   { "type": "float" },
      "soil_potassium_mgkg":    { "type": "float" },
      "temperature_c":          { "type": "float" },
      "humidity_pct":           { "type": "float" },
      "ph":                     { "type": "float" },
      "rainfall_mm":            { "type": "float" },

      "crop_suitability":       { "type": "keyword" },
      "npk_vector": {
        "type": "dense_vector",
        "dims": 7,
        "index": true,
        "similarity": "cosine"
      }
    }
  }
}
```

### vineyard-imagery (Drone + Disease Images)

```json
{
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

### vineyard-harvest (Outcome/Quality Data)

```json
{
  "mappings": {
    "properties": {
      "timestamp":        { "type": "date" },
      "vineyard_id":      { "type": "keyword" },
      "block_id":         { "type": "keyword" },
      "location":         { "type": "geo_point" },

      "grape_mass_kg":    { "type": "float" },
      "sugar_brix":       { "type": "float" },
      "acidity":          { "type": "float" },
      "ph":               { "type": "float" },
      "yan_mgL":          { "type": "float" },

      "quality_score":    { "type": "integer" },
      "variety":          { "type": "keyword" },
      "vintage_year":     { "type": "integer" }
    }
  }
}
```

---

## Demo Data Flow

```
Phase 1: Pre-loaded Historical Data (seeded before demo)
═══════════════════════════════════════════════════════════
  USDA Cook Farm (500K+ soil readings)     → vineyard-soil-historical
  Kaggle NPK (2,200 crop recommendations)  → vineyard-npk-baseline
  UCI Wine Quality (6,497 analyses)         → vineyard-harvest-quality
  Grape Disease Images (15K embeddings)     → vineyard-imagery-disease
  VineLiDAR point clouds (spatial features) → vineyard-imagery-lidar
  French Vineyard Harvest (sector yields)   → vineyard-harvest-outcomes
  SoMo.ml Regional Moisture (100K+ daily)  → vineyard-soil-regional

Phase 2: Live Sensor Data (during demo)
═══════════════════════════════════════════════════════════
  RS485 Modbus Soil Probe → soil moisture, temp → vineyard-soil-live
  RS485 NPK Sensor        → N, P, K values     → vineyard-npk-live
  Weather Station          → temp, humidity      → vineyard-weather-live
  Drone Survey             → images, LiDAR       → vineyard-imagery-live

Phase 3: Intelligence (what the demo shows)
═══════════════════════════════════════════════════════════
  "Your current soil moisture is 34% — that's in the     → kNN on soil vectors
   bottom 5th percentile for this season historically"

  "NPK levels suggest this block is optimal for          → ML crop recommendation
   Cabernet Sauvignon but marginal for Pinot Noir"

  "This leaf image matches Black Rot patterns with       → Image similarity search
   94% confidence — 847 similar cases in database"

  "Blocks B3, B7 show moisture stress trending toward    → Time-series anomaly
   the drought threshold seen in 2012 USDA data"           detection + RAG
```

---

## cuVS Race Dataset Selection

For the Act 1 GPU vs CPU indexing race, use a **combined corpus** that's visually compelling and large enough to show real speedup:

| Dataset | Records | Vector Dims | Total Vectors | Purpose |
|---------|---------|-------------|---------------|---------|
| USDA Cook Farm soil readings | 500K+ | 8 | 500K | Time-series sensor vectors |
| Grape disease image embeddings | 15K | 768 | 15K | High-dimensional image vectors |
| SoMo.ml regional soil moisture | 100K+ | 6 | 100K | Dense environmental vectors |
| **Combined** | **~615K+** | **mixed** | **615K+** | **GPU vs CPU race corpus** |

The race indexes all 615K+ vectors into ES — same data, GPU-accelerated HNSW vs CPU HNSW. The mixed dimensionality (8-dim sensor + 768-dim image) tells a richer story than synthetic benchmarks.

---

## Download & Preprocessing Plan

```bash
# Script: scripts/download-datasets.sh

# 1. USDA Cook Farm — bulk download from Ag Data Commons
# 2. Kaggle NPK — kaggle datasets download atharvaingle/crop-recommendation-dataset
# 3. UCI Wine Quality — direct CSV download
# 4. French Vineyard — from paper supplementary data
# 5. VineLiDAR — zenodo-get 8113105 (2.8 GB)
# 6. Grape Disease — kaggle datasets download rm1000/grape-disease-dataset-original
# 7. PlantVillage Grape — kaggle datasets download piyushmishra1999/plantvillage-grape
# 8. SoMo.ml — extract VA/MD wine regions from NetCDF

# Preprocessing outputs JSONL files aligned to index schemas above
# Pre-compute embeddings for images (CLIP via Ollama)
# Pre-compute sensor reading vectors (normalize + combine)
# All stored in /opt/ddil/data/preprocessed/
```

---

## Estimated Storage Requirements

| Dataset | Raw Size | Preprocessed (JSONL) | With Embeddings | ES Index Size |
|---------|----------|---------------------|-----------------|---------------|
| USDA Cook Farm | ~200 MB | ~300 MB | ~350 MB | ~500 MB |
| Kaggle NPK | 65 KB | 1 MB | 1 MB | 2 MB |
| UCI Wine | 100 KB | 2 MB | 2 MB | 3 MB |
| French Vineyard | ~50 MB | ~20 MB | ~20 MB | ~30 MB |
| VineLiDAR | 2.8 GB | ~500 MB (features) | ~600 MB | ~800 MB |
| Grape Disease Images | 158 MB | ~100 MB | ~200 MB | ~300 MB |
| SoMo.ml (regional) | ~1 GB (extract) | ~200 MB | ~250 MB | ~350 MB |
| **Total** | **~4.4 GB** | **~1.1 GB** | **~1.4 GB** | **~2 GB** |

Fits comfortably within the 800 GB Elasticsearch LVM volume.
