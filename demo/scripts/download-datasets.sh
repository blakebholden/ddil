#!/bin/bash
# ============================================================
# Download all datasets for Vineyard Intelligence demo
# ============================================================
set -euo pipefail

DATA_DIR="$(cd "$(dirname "$0")/../data/raw" && pwd)"
mkdir -p "$DATA_DIR"

echo "Downloading datasets to: $DATA_DIR"
echo ""

# ── 1. Kaggle Crop Recommendation (NPK) ─────────────────────
echo "── [1/5] Kaggle Crop Recommendation ──"
if [ -d "$DATA_DIR/crop-recommendation" ]; then
  echo "  Already downloaded, skipping."
else
  if ! command -v kaggle &>/dev/null; then
    echo "  WARNING: kaggle CLI not found. Install: pip install kaggle"
    echo "  Then place API key in ~/.kaggle/kaggle.json"
  else
    kaggle datasets download atharvaingle/crop-recommendation-dataset \
      -p "$DATA_DIR/crop-recommendation" --unzip
    echo "  Done."
  fi
fi
echo ""

# ── 2. UCI Wine Quality ──────────────────────────────────────
echo "── [2/5] UCI Wine Quality ──"
if [ -f "$DATA_DIR/wine-quality/winequality-red.csv" ]; then
  echo "  Already downloaded, skipping."
else
  mkdir -p "$DATA_DIR/wine-quality"
  curl -sL "https://archive.ics.uci.edu/ml/machine-learning-databases/wine-quality/winequality-red.csv" \
    -o "$DATA_DIR/wine-quality/winequality-red.csv"
  curl -sL "https://archive.ics.uci.edu/ml/machine-learning-databases/wine-quality/winequality-white.csv" \
    -o "$DATA_DIR/wine-quality/winequality-white.csv"
  echo "  Done."
fi
echo ""

# ── 3. Grape Disease Images ──────────────────────────────────
echo "── [3/5] Grape Disease Images ──"
if [ -d "$DATA_DIR/grape-disease" ]; then
  echo "  Already downloaded, skipping."
else
  if ! command -v kaggle &>/dev/null; then
    echo "  WARNING: kaggle CLI not found."
  else
    kaggle datasets download rm1000/grape-disease-dataset-original \
      -p "$DATA_DIR/grape-disease" --unzip
    echo "  Done."
  fi
fi
echo ""

# ── 4. PlantVillage Grape Subset ─────────────────────────────
echo "── [4/5] PlantVillage Grape Subset ──"
if [ -d "$DATA_DIR/plantvillage-grape" ]; then
  echo "  Already downloaded, skipping."
else
  if ! command -v kaggle &>/dev/null; then
    echo "  WARNING: kaggle CLI not found."
  else
    kaggle datasets download piyushmishra1999/plantvillage-grape \
      -p "$DATA_DIR/plantvillage-grape" --unzip
    echo "  Done."
  fi
fi
echo ""

# ── 5. USDA Cook Farm ────────────────────────────────────────
echo "── [5/5] USDA Cook Farm ──"
if [ -d "$DATA_DIR/cook-farm" ]; then
  echo "  Already downloaded, skipping."
else
  echo "  MANUAL DOWNLOAD REQUIRED:"
  echo "  1. Go to: https://data.nal.usda.gov/dataset/data-cook-agronomy-farm"
  echo "  2. Download the CSV files"
  echo "  3. Place them in: $DATA_DIR/cook-farm/"
  echo ""
  echo "  Alternative: The R package 'FedData' can access this data."
  mkdir -p "$DATA_DIR/cook-farm"
fi
echo ""

echo "══════════════════════════════════════════════════"
echo "Optional large datasets (download separately):"
echo "  VineLiDAR (2.8 GB):  pip install zenodo-get && zenodo_get 8113105 -o $DATA_DIR/vinelidar"
echo "  SoMo.ml:             See https://www.nature.com/articles/s41597-021-00831-0"
echo "══════════════════════════════════════════════════"
