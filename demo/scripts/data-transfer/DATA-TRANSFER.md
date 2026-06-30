# Moving the datasets to the kit (S3 relay)

The kit is airgapped, and the SEC corpus alone is 2.1 GB — too big for GitHub
(100 MB/file limit) and pointless over Git LFS (the kit can't pull at demo time).
Use **S3 as a one-time relay**: bundle here → upload → pull on the kit during a
brief connected setup window → verify → place → go offline.

## What moves (required ≈ 2.4 GB raw → ~1 GB after gzip)

| Bundle | From | To (on kit) |
|---|---|---|
| `sec_10k_bulk.ndjson.gz` | `bench-aws/finance/sec_10k_bulk.ndjson` (gzipped, 2.1→~0.6 GB) | `/data/sec/` |
| `hires_chunks.jsonl`, `hires_images.jsonl` | `~/Desktop/Jina/demo-multimodal/scale/` | `/data/jina/scale/` |
| `extracted_imgs.tar` (285 MB) | `…/scale/extracted_imgs/` | `/data/jina/scale/extracted_imgs/` |
| `images.tar` + `manifest.json` (10-doc) | `~/Desktop/Jina/demo-multimodal/` | `/data/jina/` |
| `samples.tar` (1.5 GB, **optional**) | `…/scale/samples/` | `/data/jina/scale/samples/` |

Paths match `.env.airgapped` (`JINA_FIG_DIR`, `JINA_PDF_DIR`, `JINA_IMG_DIR`) and
the ingest scripts. The SEC `.gz` is read directly by `reembed-local.py`.

## 1. Upload (here, on the Mac)

```bash
cd demo/scripts/data-transfer
S3_BUCKET=ddil-transfer-$(whoami) AWS_PROFILE=eck-workshop AWS_REGION=us-east-2 \
  bash package-and-upload.sh
# add INCLUDE_PDFS=1 to also ship the 1.5 GB samples/ PDFs
```
Builds `dist/` (gzipped + tarred + `CHECKSUMS.txt`), creates the bucket if needed,
and `aws s3 sync`s it up. Requires the AWS CLI + creds for your profile.

## 2. Pull + place (on the kit, connected window)

```bash
cd demo/scripts/data-transfer
S3_BUCKET=ddil-transfer-<whoami> AWS_PROFILE=eck-workshop AWS_REGION=us-east-2 \
  DATA_ROOT=/data bash stage-from-s3.sh
```
Syncs down, **verifies SHA256 checksums**, untars, and places everything under
`/data`. Then run the SEC + Jina ingests (`SEC-AIRGAP-SETUP.md`, `JINA-SETUP.md`)
and take the kit offline. You can delete the S3 objects afterward.

## Models / Docker images (separate, same relay)

The Jina **omni-small** server image (multi-GB, needs the Blackwell cu128 build)
moves the same way — it's just a bigger object:
```bash
# here:  docker save jina/omni-small:cu128 | gzip | aws s3 cp - s3://$BUCKET/img/omni-small.tar.gz
# kit:   aws s3 cp s3://$BUCKET/img/omni-small.tar.gz - | gunzip | docker load
```
(Or use the `jina-airgap` toolkit's bundle/deploy, which does the same save/load.)
The SEC path has no model to move — it re-embeds with the kit's existing local
`nomic-embed-text`.

## Notes
- Keep the bucket **private**; the SEC/Jina corpora aren't secret but there's no
  reason to expose them. Delete after staging.
- `aws s3 cp/sync` does multipart + resumes, so a dropped connection mid-transfer
  is fine — just re-run.
- No secrets are baked into these scripts; they use your AWS profile/creds.
