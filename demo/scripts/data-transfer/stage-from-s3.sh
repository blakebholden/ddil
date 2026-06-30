#!/usr/bin/env bash
# stage-from-s3.sh — pull the SEC + Jina bundles from S3 onto the KIT, verify
# checksums, and place them at the paths the ingest scripts + .env.airgapped
# expect. Run on the kit during a connected setup window, BEFORE airgap.
#
# Usage:
#   S3_BUCKET=my-ddil-transfer AWS_PROFILE=eck-workshop AWS_REGION=us-east-2 \
#   DATA_ROOT=/data bash stage-from-s3.sh
set -euo pipefail

S3_BUCKET="${S3_BUCKET:?set S3_BUCKET}"
S3_PREFIX="${S3_PREFIX:-ddil-data}"
DATA_ROOT="${DATA_ROOT:-/data}"
PROFILE_ARGS=(); [ -n "${AWS_PROFILE:-}" ] && PROFILE_ARGS=(--profile "$AWS_PROFILE")
[ -n "${AWS_REGION:-}" ] && export AWS_DEFAULT_REGION="$AWS_REGION"

DL="${DL:-$DATA_ROOT/_transfer}"
mkdir -p "$DL"

echo "==> aws s3 sync ← s3://$S3_BUCKET/$S3_PREFIX/"
aws "${PROFILE_ARGS[@]}" s3 sync "s3://$S3_BUCKET/$S3_PREFIX/" "$DL/" --only-show-errors

echo "==> verifying checksums"
( cd "$DL" && sha256sum -c CHECKSUMS.txt ) || { echo "CHECKSUM MISMATCH — re-sync"; exit 1; }

echo "==> placing files under $DATA_ROOT"
mkdir -p "$DATA_ROOT/sec" "$DATA_ROOT/jina/scale"

# SEC — leave gzipped; reembed-local.py reads .gz directly
cp "$DL/sec/sec_10k_bulk.ndjson.gz" "$DATA_ROOT/sec/"

# Jina text + manifest
cp "$DL/jina/scale/hires_chunks.jsonl" "$DL/jina/scale/hires_images.jsonl" "$DATA_ROOT/jina/scale/"
cp "$DL/jina/manifest.json" "$DATA_ROOT/jina/"

# Jina images (untar)
tar -C "$DATA_ROOT/jina" -xf "$DL/jina/images.tar"
tar -C "$DATA_ROOT/jina/scale" -xf "$DL/jina/scale/extracted_imgs.tar"
[ -f "$DL/jina/scale/samples.tar" ] && tar -C "$DATA_ROOT/jina/scale" -xf "$DL/jina/scale/samples.tar" || echo "  (no samples.tar — PDF links will 404, that's fine)"

echo
echo "✅ staged. Layout:"
echo "   $DATA_ROOT/sec/sec_10k_bulk.ndjson.gz"
echo "   $DATA_ROOT/jina/{manifest.json,images/}"
echo "   $DATA_ROOT/jina/scale/{hires_chunks.jsonl,hires_images.jsonl,extracted_imgs/[,samples/]}"
echo
echo "Next:"
echo "   SEC : cd demo/scripts/finance && python3 reembed-local.py --src $DATA_ROOT/sec/sec_10k_bulk.ndjson.gz ... (see SEC-AIRGAP-SETUP.md)"
echo "   Jina: cd demo/scripts/jina && bash setup-indices-local.sh && python3 ingest-pmc.py --data $DATA_ROOT/jina/scale (see JINA-SETUP.md)"
echo
echo "Once staged + ingested, you can delete $DL and take the kit offline."
