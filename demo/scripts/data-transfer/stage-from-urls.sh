#!/usr/bin/env bash
# stage-from-urls.sh — KIT side, NO AWS CLI needed. Downloads the dataset bundles
# via presigned URLs (from presign.sh → urls.txt), verifies SHA256, and places
# everything under $DATA_ROOT to match .env.airgapped + the ingest scripts.
#
# Needs only: curl, tar, sha256sum. Put urls.txt next to this script first.
#
# Usage (on the kit, connected window):
#   DATA_ROOT=/data bash stage-from-urls.sh
set -euo pipefail

DATA_ROOT="${DATA_ROOT:-/data}"
URLS="${URLS:-./urls.txt}"
DL="${DL:-$DATA_ROOT/_transfer}"
[ -s "$URLS" ] || { echo "missing $URLS (run presign.sh on the Mac, copy it here)"; exit 1; }
mkdir -p "$DL"

echo "==> downloading bundles via presigned URLs"
while IFS=$'\t' read -r rel url; do
  [ -z "${rel:-}" ] && continue
  mkdir -p "$DL/$(dirname "$rel")"
  echo "  ↓ $rel"
  curl -fSL --retry 5 --retry-delay 3 -o "$DL/$rel" "$url"
done < "$URLS"

echo "==> verifying checksums"
( cd "$DL" && sha256sum -c CHECKSUMS.txt ) || { echo "CHECKSUM MISMATCH — re-download"; exit 1; }

echo "==> placing files under $DATA_ROOT"
mkdir -p "$DATA_ROOT/sec" "$DATA_ROOT/jina/scale"
cp "$DL/sec/sec_10k_bulk.ndjson.gz" "$DATA_ROOT/sec/"
cp "$DL/jina/scale/hires_chunks.jsonl" "$DL/jina/scale/hires_images.jsonl" "$DATA_ROOT/jina/scale/"
cp "$DL/jina/manifest.json" "$DATA_ROOT/jina/"
tar -C "$DATA_ROOT/jina" -xf "$DL/jina/images.tar"
tar -C "$DATA_ROOT/jina/scale" -xf "$DL/jina/scale/extracted_imgs.tar"
[ -f "$DL/jina/scale/samples.tar" ] && tar -C "$DATA_ROOT/jina/scale" -xf "$DL/jina/scale/samples.tar" || echo "  (no samples.tar — PDF links 404, fine)"

echo
echo "✅ staged under $DATA_ROOT. Next: run the SEC + Jina ingests"
echo "   (SEC-AIRGAP-SETUP.md, JINA-SETUP.md). Then take the kit offline."
echo "   You can delete $DL and the S3 bucket afterward."
