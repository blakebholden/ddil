#!/usr/bin/env bash
# presign.sh — after package-and-upload.sh, generate presigned HTTPS URLs for the
# uploaded objects so the KIT can download with plain curl (NO AWS CLI / creds /
# public bucket needed). Run on the Mac. Presigning is a local signature op.
#
# Usage:
#   S3_BUCKET=ddil-transfer-461485115270 AWS_PROFILE=eck-workshop AWS_REGION=us-east-2 \
#   bash presign.sh
set -euo pipefail

S3_BUCKET="${S3_BUCKET:?set S3_BUCKET}"
S3_PREFIX="${S3_PREFIX:-ddil-data}"
EXPIRY="${EXPIRY:-604800}"   # seconds; 7 days is the IAM-user max
OUT="${OUT:-./urls.txt}"
PROFILE_ARGS=(); [ -n "${AWS_PROFILE:-}" ] && PROFILE_ARGS=(--profile "$AWS_PROFILE")
[ -n "${AWS_REGION:-}" ] && export AWS_DEFAULT_REGION="$AWS_REGION"

: > "$OUT"
keys=$(aws "${PROFILE_ARGS[@]}" s3api list-objects-v2 --bucket "$S3_BUCKET" \
        --prefix "$S3_PREFIX/" --query 'Contents[].Key' --output text)
for key in $keys; do
  rel="${key#"$S3_PREFIX"/}"
  url=$(aws "${PROFILE_ARGS[@]}" s3 presign "s3://$S3_BUCKET/$key" --expires-in "$EXPIRY")
  printf '%s\t%s\n' "$rel" "$url" >> "$OUT"
done

n=$(wc -l < "$OUT" | tr -d ' ')
echo "✅ wrote $OUT — $n presigned URLs, valid $((EXPIRY/86400)) days"
echo
echo "Get $OUT onto the kit (it's a small text file — scp/paste), alongside"
echo "stage-from-urls.sh, then on the kit run:"
echo "   DATA_ROOT=/data bash stage-from-urls.sh"
