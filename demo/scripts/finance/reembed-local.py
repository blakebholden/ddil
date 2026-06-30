#!/usr/bin/env python3
"""reembed-local.py — re-embed the SEC 10-K corpus with a LOCAL Ollama model.

The bench corpus (bench-aws/finance/sec_10k_bulk.ndjson) was embedded with
Bedrock Cohere Embed v4 (1536-d). For the airgapped kit there is no Bedrock, so
this re-embeds each chunk's `text` with the kit's local embedder
(nomic-embed-text, 768-d by default) and writes a new bulk-NDJSON whose `emb`
dims match the airgapped index built by setup-index-local.sh.

The query path (demo/backend/app/routers/finance.py with EMBED_BACKEND=ollama)
uses the SAME model/endpoint with raw text — no task prefix on either side —
so document and query vectors live in one space.

Input  : a bulk-NDJSON (alternating {"index":{}} / doc lines) with a `text`
         field. The existing `emb` field, if present, is dropped and replaced.
Output : a bulk-NDJSON ready for ES /_bulk.

Usage:
  python3 reembed-local.py \
      --src   /path/to/sec_10k_bulk.ndjson \
      --out   ./sec_10k_local.ndjson \
      --ollama http://192.168.1.20:11434 \
      --model nomic-embed-text \
      --batch 64
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
import time
import urllib.request


def embed_batch(ollama: str, model: str, texts: list[str], retries: int = 6) -> list[list[float]]:
    """Embed a batch via Ollama /api/embed. Returns one vector per input text."""
    body = json.dumps({"model": model, "input": texts}).encode()
    url = f"{ollama.rstrip('/')}/api/embed"
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=body, method="POST",
                                         headers={"Content-Type": "application/json"})
            resp = urllib.request.urlopen(req, timeout=300).read()
            payload = json.loads(resp)
            embs = payload.get("embeddings")
            if not embs or len(embs) != len(texts):
                raise RuntimeError(f"expected {len(texts)} embeddings, got {len(embs) if embs else 0}")
            return embs
        except Exception as e:  # noqa: BLE001 — retry any transport/model hiccup
            wait = min(30, 2 ** attempt)
            print(f"  batch err ({e!r}); retry in {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"batch failed after {retries} retries")


def iter_docs(src: str):
    """Yield doc dicts from a bulk-NDJSON (plain or .gz), skipping action lines."""
    opener = gzip.open if src.endswith(".gz") else open
    with opener(src, "rt", errors="replace") as f:
        while True:
            action = f.readline()
            if not action:
                return
            doc_line = f.readline()
            if not doc_line:
                return
            line = doc_line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="source bulk-NDJSON (Cohere-embedded or text-only)")
    ap.add_argument("--out", default="./sec_10k_local.ndjson")
    ap.add_argument("--ollama", default="http://192.168.1.20:11434")
    ap.add_argument("--model", default="nomic-embed-text")
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--max-docs", type=int, default=None)
    args = ap.parse_args()

    n = 0
    dims = None
    t0 = time.time()
    pending_docs: list[dict] = []

    def flush(out_f, batch: list[dict]) -> None:
        nonlocal n, dims
        if not batch:
            return
        vecs = embed_batch(args.ollama, args.model, [d["text"] for d in batch])
        for doc, vec in zip(batch, vecs):
            if dims is None:
                dims = len(vec)
                print(f"  embedding dims = {dims}")
            doc = {k: v for k, v in doc.items() if k != "emb"}
            doc["emb"] = vec
            out_f.write(json.dumps({"index": {}}) + "\n")
            out_f.write(json.dumps(doc) + "\n")
            n += 1

    with open(args.out, "w") as out_f:
        for doc in iter_docs(args.src):
            if "text" not in doc:
                continue
            pending_docs.append(doc)
            if len(pending_docs) >= args.batch:
                flush(out_f, pending_docs)
                pending_docs = []
                if n % 2000 == 0:
                    rate = n / (time.time() - t0)
                    print(f"  chunks={n:>6}  rate={rate:.1f}/s")
                if args.max_docs and n >= args.max_docs:
                    break
        if not (args.max_docs and n >= args.max_docs):
            flush(out_f, pending_docs)

    elapsed = time.time() - t0
    print(f"done: {n} chunks → {args.out} ({dims}-d) in {elapsed:.0f}s")
    print(f"next: DIMS={dims} bash setup-index-local.sh {args.out}")


if __name__ == "__main__":
    main()
