#!/bin/bash
# ============================================================
# Create Elasticsearch indices on both GPU and CPU instances
# ============================================================
set -euo pipefail

ES_GPU="${1:-http://192.168.1.20:9200}"
ES_CPU="${2:-http://192.168.1.20:9201}"

create_index() {
  local es_url="$1"
  local index="$2"
  local mapping="$3"
  local label="$4"

  # Check if index exists
  if curl -s -o /dev/null -w "%{http_code}" "$es_url/$index" | grep -q "200"; then
    echo "  [$label] $index already exists, skipping."
    return
  fi

  # Create index
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$es_url/$index" \
    -H "Content-Type: application/json" \
    -d "$mapping")

  if [ "$HTTP_CODE" = "200" ]; then
    echo "  [$label] $index created."
  else
    echo "  [$label] $index FAILED (HTTP $HTTP_CODE)"
  fi
}

# ── Index Mappings ───────────────────────────────────────────

SOIL_MAPPING='{
  "settings": {"number_of_shards": 1, "number_of_replicas": 0},
  "mappings": {
    "properties": {
      "timestamp": {"type": "date"},
      "vineyard_id": {"type": "keyword"},
      "block_id": {"type": "keyword"},
      "station_id": {"type": "keyword"},
      "location": {"type": "geo_point"},
      "source": {"type": "keyword"},
      "soil_moisture_pct": {"type": "float"},
      "soil_temp_6in_c": {"type": "float"},
      "soil_temp_12in_c": {"type": "float"},
      "soil_temp_24in_c": {"type": "float"},
      "electrical_conductivity": {"type": "float"},
      "depth_cm": {"type": "integer"},
      "reading_vector": {"type": "dense_vector", "dims": 8, "index": true, "similarity": "cosine"}
    }
  }
}'

NPK_MAPPING='{
  "settings": {"number_of_shards": 1, "number_of_replicas": 0},
  "mappings": {
    "properties": {
      "timestamp": {"type": "date"},
      "vineyard_id": {"type": "keyword"},
      "block_id": {"type": "keyword"},
      "source": {"type": "keyword"},
      "location": {"type": "geo_point"},
      "soil_nitrogen_mgkg": {"type": "float"},
      "soil_phosphorus_mgkg": {"type": "float"},
      "soil_potassium_mgkg": {"type": "float"},
      "temperature_c": {"type": "float"},
      "humidity_pct": {"type": "float"},
      "ph": {"type": "float"},
      "rainfall_mm": {"type": "float"},
      "crop_suitability": {"type": "keyword"},
      "npk_vector": {"type": "dense_vector", "dims": 7, "index": true, "similarity": "cosine"}
    }
  }
}'

IMAGERY_MAPPING='{
  "settings": {"number_of_shards": 1, "number_of_replicas": 0},
  "mappings": {
    "properties": {
      "timestamp": {"type": "date"},
      "vineyard_id": {"type": "keyword"},
      "block_id": {"type": "keyword"},
      "source": {"type": "keyword"},
      "location": {"type": "geo_point"},
      "image_path": {"type": "keyword"},
      "image_type": {"type": "keyword"},
      "classification": {"type": "keyword"},
      "confidence": {"type": "float"},
      "altitude_m": {"type": "float"},
      "description": {"type": "text", "analyzer": "english"},
      "image_embedding": {"type": "dense_vector", "dims": 768, "index": true, "similarity": "cosine"}
    }
  }
}'

HARVEST_MAPPING='{
  "settings": {"number_of_shards": 1, "number_of_replicas": 0},
  "mappings": {
    "properties": {
      "timestamp": {"type": "date"},
      "vineyard_id": {"type": "keyword"},
      "block_id": {"type": "keyword"},
      "location": {"type": "geo_point"},
      "grape_mass_kg": {"type": "float"},
      "sugar_brix": {"type": "float"},
      "acidity": {"type": "float"},
      "ph": {"type": "float"},
      "yan_mgL": {"type": "float"},
      "quality_score": {"type": "integer"},
      "variety": {"type": "keyword"},
      "vintage_year": {"type": "integer"}
    }
  }
}'

WINE_MAPPING='{
  "settings": {"number_of_shards": 1, "number_of_replicas": 0},
  "mappings": {
    "properties": {
      "timestamp": {"type": "date"},
      "wine_type": {"type": "keyword"},
      "fixed_acidity": {"type": "float"},
      "volatile_acidity": {"type": "float"},
      "citric_acid": {"type": "float"},
      "residual_sugar": {"type": "float"},
      "chlorides": {"type": "float"},
      "free_sulfur_dioxide": {"type": "float"},
      "total_sulfur_dioxide": {"type": "float"},
      "density": {"type": "float"},
      "ph": {"type": "float"},
      "sulphates": {"type": "float"},
      "alcohol": {"type": "float"},
      "quality": {"type": "integer"}
    }
  }
}'

# ── Create on GPU instance ───────────────────────────────────
echo "Creating indices on GPU instance ($ES_GPU):"
for idx_name in vineyard-soil vineyard-npk vineyard-imagery vineyard-harvest vineyard-wine; do
  case "$idx_name" in
    vineyard-soil)    mapping="$SOIL_MAPPING" ;;
    vineyard-npk)     mapping="$NPK_MAPPING" ;;
    vineyard-imagery) mapping="$IMAGERY_MAPPING" ;;
    vineyard-harvest) mapping="$HARVEST_MAPPING" ;;
    vineyard-wine)    mapping="$WINE_MAPPING" ;;
  esac
  create_index "$ES_GPU" "$idx_name" "$mapping" "GPU"
done

echo ""

# ── Create on CPU instance ───────────────────────────────────
echo "Creating indices on CPU instance ($ES_CPU):"
for idx_name in vineyard-soil vineyard-npk vineyard-imagery vineyard-harvest vineyard-wine; do
  case "$idx_name" in
    vineyard-soil)    mapping="$SOIL_MAPPING" ;;
    vineyard-npk)     mapping="$NPK_MAPPING" ;;
    vineyard-imagery) mapping="$IMAGERY_MAPPING" ;;
    vineyard-harvest) mapping="$HARVEST_MAPPING" ;;
    vineyard-wine)    mapping="$WINE_MAPPING" ;;
  esac
  create_index "$ES_CPU" "$idx_name" "$mapping" "CPU"
done

echo ""
echo "Done."
