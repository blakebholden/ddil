#!/usr/bin/env bash
# package-and-upload.sh — bundle the SEC + Jina datasets, checksum them, and push
# to S3 as a transfer relay to the airgapped kit. Run on the Mac (the box that
# currently holds the data).
#
# Pulls down on the kit with stage-from-s3.sh during a connected setup window.
#
# Usage:
#   S3_BUCKET=my-ddil-transfer AWS_PROFILE=eck-workshop AWS_REGION=us-east-2 \
#   bash package-and-upload.sh                 # required SEC + Jina (~2.4 GB → ~1 GB after gzip)
#   INCLUDE_PDFS=1 bash package-and-upload.sh  # also the 1.5 GB samples/ PDFs (optional)
set -euo pipefail

S3_BUCKET="${S3_BUCKET:?set S3_BUCKET (e.g. my-ddil-transfer)}"
S3_PREFIX="${S3_PREFIX:-ddil-data}"
PROFILE_ARGS=(); [ -n "${AWS_PROFILE:-}" ] && PROFILE_ARGS=(--profile "$AWS_PROFILE")
[ -n "${AWS_REGION:-}" ] && export AWS_DEFAULT_REGION="$AWS_REGION"

# Source locations (override if yours differ)
DDIL="${DDIL:-$(cd "$(dirname "$0")/../../.." && pwd)}"      # repo root
SEC_NDJSON="${SEC_NDJSON:-$DDIL/bench-aws/finance/sec_10k_bulk.ndjson}"
JINA="${JINA:-$HOME/Desktop/Jina/demo-multimodal}"

WORK="${WORK:-$DDIL/demo/scripts/data-transfer/dist}"
mkdir -p "$WORK/sec" "$WORK/jina/scale"   # idempotent: existing bundles are reused

# checksum command (xargs needs a real binary, not a shell function)
if command -v sha256sum >/dev/null; then SHA=(sha256sum); else SHA=(shasum -a 256); fi

if [ -s "$WORK/sec/sec_10k_bulk.ndjson.gz" ]; then
  echo "==> SEC: gzip already present, skipping"
else
  echo "==> SEC: gzip $(du -h "$SEC_NDJSON" | cut -f1) ndjson → ~⅓ size"
  gzip -c "$SEC_NDJSON" > "$WORK/sec/sec_10k_bulk.ndjson.gz"
fi

echo "==> Jina: jsonl + manifest (small, copied as-is)"
cp "$JINA/scale/hires_chunks.jsonl" "$JINA/scale/hires_images.jsonl" "$WORK/jina/scale/"
cp "$JINA/manifest.json" "$WORK/jina/"

echo "==> Jina: tar the image dirs (jpg/png don't gzip, so plain tar for one-file transfer)"
[ -s "$WORK/jina/images.tar" ] || tar -C "$JINA" -cf "$WORK/jina/images.tar" images
[ -s "$WORK/jina/scale/extracted_imgs.tar" ] || tar -C "$JINA/scale" -cf "$WORK/jina/scale/extracted_imgs.tar" extracted_imgs

if [ "${INCLUDE_PDFS:-0}" = "1" ]; then
  echo "==> Jina: samples/ PDFs (optional, 1.5 GB)"
  [ -s "$WORK/jina/scale/samples.tar" ] || tar -C "$JINA/scale" -cf "$WORK/jina/scale/samples.tar" samples
fi

echo "==> checksums"
( cd "$WORK" && find . -type f ! -name CHECKSUMS.txt -print0 | xargs -0 "${SHA[@]}" > CHECKSUMS.txt )
cat "$WORK/CHECKSUMS.txt"
echo "==> bundle size:"; du -sh "$WORK"

echo "==> aws s3 sync → s3://$S3_BUCKET/$S3_PREFIX/"
aws "${PROFILE_ARGS[@]}" s3 mb "s3://$S3_BUCKET" 2>/dev/null || true
# Retry the whole sync: already-uploaded objects are skipped, so each pass only
# re-attempts what's missing. Survives a transient connection drop mid-file.
export AWS_MAX_ATTEMPTS="${AWS_MAX_ATTEMPTS:-12}"   # SDK-level per-request retries
ok=0
for attempt in 1 2 3 4 5 6 7 8; do
  if aws "${PROFILE_ARGS[@]}" s3 sync "$WORK/" "s3://$S3_BUCKET/$S3_PREFIX/" \
       --only-show-errors --cli-read-timeout 0; then ok=1; break; fi
  echo "   sync attempt $attempt hit a network error — uploaded files are skipped; retrying in 10s…"
  sleep 10
done
# clean up any orphaned multipart parts from failed attempts (avoids storage cost)
aws "${PROFILE_ARGS[@]}" s3api list-multipart-uploads --bucket "$S3_BUCKET" --prefix "$S3_PREFIX/" \
  --query 'Uploads[].[Key,UploadId]' --output text 2>/dev/null | while read -r k u; do
    [ -n "$u" ] && aws "${PROFILE_ARGS[@]}" s3api abort-multipart-upload --bucket "$S3_BUCKET" --key "$k" --upload-id "$u" 2>/dev/null || true
  done
[ "$ok" = 1 ] || { echo "❌ sync still failing after retries — re-run when the link is stable"; exit 1; }
echo
echo "✅ uploaded. On the kit (connected setup window) run:"
echo "   S3_BUCKET=$S3_BUCKET AWS_PROFILE=${AWS_PROFILE:-default} AWS_REGION=${AWS_REGION:-us-east-2} bash stage-from-s3.sh"
