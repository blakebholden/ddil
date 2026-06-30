#!/usr/bin/env python3
"""ingest-pmc.py — embed + index the PMC research corpus into pmc-unstructured
with deterministic DLS markings, on the kit's local cluster.

Reads the staged data artifacts (from the Jina demo's scale/ dir):
  hires_chunks.jsonl   text chunks  → one ES doc each, chunk_type="text"
  hires_images.jsonl   parent→figure paths → one ES doc per figure, chunk_type="image"
  extracted_imgs/      the figure image files referenced by media_path

Text and figures are embedded by the local Jina omni server (1024-d, the
pmc-unstructured dims). Markings come from markings.py (same parent_id → same
marking across all its chunks + figures).

Usage:
  ES_URL=http://192.168.1.20:9200 OMNI_URL=http://192.168.1.20:8081 EP=changeme \
  python3 ingest-pmc.py --data /data/jina/scale
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

from markings import assign_markings

TEXT_FIELDS = [
    "parent_id", "doc_title", "journal", "subject", "year", "license_code",
    "doc_type", "language", "source", "chunk_ordinal", "chunk_type", "page",
    "section", "content",
]


def _req(url: str, data: bytes, headers: dict, timeout: int = 300) -> bytes:
    req = urllib.request.Request(url, data=data, method="POST", headers=headers)
    return urllib.request.urlopen(req, timeout=timeout).read()


def omni_embed(omni: str, model: str, inputs: list, retries: int = 6) -> list[list[float]]:
    """inputs: list of str (text) or dicts (image parts). Returns one vec each."""
    body = json.dumps({"input": inputs, "model": model}).encode()
    url = f"{omni.rstrip('/')}/v1/embeddings"
    for attempt in range(retries):
        try:
            payload = json.loads(_req(url, body, {"Content-Type": "application/json"}))
            return [d["embedding"] for d in payload["data"]]
        except Exception as e:  # noqa: BLE001
            wait = min(30, 2 ** attempt)
            print(f"  omni err ({e!r}); retry in {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("omni embed failed")


def page_from(fn: str) -> int:
    m = re.search(r"(?:figure|table)-(\d+)", fn)
    return int(m.group(1)) if m else 1


def bulk_post(es: str, index: str, auth_header: dict, lines: list[bytes]) -> tuple[int, int]:
    if not lines:
        return 0, 0
    body = b"".join(lines)
    url = f"{es}/{index}/_bulk?filter_path=errors,items.index.status"
    headers = {"Content-Type": "application/x-ndjson", **auth_header}
    try:
        resp = json.loads(_req(url, body, headers, timeout=180))
        ok = sum(1 for it in resp.get("items", []) if it.get("index", {}).get("status", 500) < 300)
        return ok, len(resp.get("items", [])) - ok
    except Exception as e:  # noqa: BLE001
        print(f"  bulk failed: {e}", file=sys.stderr)
        return 0, len(lines) // 2


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="/data/jina/scale", help="dir with hires_chunks.jsonl etc.")
    ap.add_argument("--index", default="pmc-unstructured")
    ap.add_argument("--es", default=os.environ.get("ES_URL", "http://192.168.1.20:9200"))
    ap.add_argument("--omni", default=os.environ.get("OMNI_URL", "http://192.168.1.20:8081"))
    ap.add_argument("--model", default=os.environ.get("OMNI_MODEL", "jina-embeddings-v5-omni-small"))
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--max-docs", type=int, default=None)
    args = ap.parse_args()

    data = Path(args.data)
    eu, ep = os.environ.get("EU", "elastic"), os.environ.get("EP", "changeme")
    auth_header = {"Authorization": "Basic " + base64.b64encode(f"{eu}:{ep}".encode()).decode()}

    # ── text chunks ───────────────────────────────────────────────────────────
    chunks_path = data / "hires_chunks.jsonl"
    titles: dict[str, str] = {}
    n_text = n_ok = n_fail = 0
    t0 = time.time()
    pending: list[dict] = []
    buf: list[bytes] = []

    def flush_text(batch: list[dict]):
        nonlocal n_ok, n_fail
        if not batch:
            return
        vecs = omni_embed(args.omni, args.model, [b["content"] for b in batch])
        lines: list[bytes] = []
        for src, vec in zip(batch, vecs):
            doc = {k: src.get(k) for k in TEXT_FIELDS}
            doc["chunk_type"] = "text"
            doc.update(assign_markings(src["parent_id"]))
            doc["embedding"] = vec
            _id = f'{src["parent_id"]}-{src.get("chunk_ordinal", 0)}'
            lines.append(json.dumps({"index": {"_id": _id}}).encode() + b"\n")
            lines.append(json.dumps(doc).encode() + b"\n")
        ok, fail = bulk_post(args.es, args.index, auth_header, lines)
        n_ok += ok
        n_fail += fail

    print(f"==> text chunks from {chunks_path}")
    with open(chunks_path, errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            titles.setdefault(rec["parent_id"], rec.get("doc_title", ""))
            pending.append(rec)
            n_text += 1
            if len(pending) >= args.batch:
                flush_text(pending)
                pending = []
                if n_text % 1000 == 0:
                    print(f"  text={n_text} ok={n_ok} fail={n_fail} rate={n_text/(time.time()-t0):.1f}/s")
            if args.max_docs and n_text >= args.max_docs:
                break
    flush_text(pending)
    print(f"  text done: {n_text} chunks · ok={n_ok} fail={n_fail}")

    # ── figures ───────────────────────────────────────────────────────────────
    images_path = data / "hires_images.jsonl"
    img_root = data / "extracted_imgs"
    n_img = i_ok = i_fail = 0
    if images_path.is_file():
        print(f"==> figures from {images_path}")
        with open(images_path, errors="replace") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                pid = rec["parent_id"]
                title = titles.get(pid, pid)
                marks = assign_markings(pid)
                lines: list[bytes] = []
                for i, rel in enumerate(rec.get("images", [])):
                    fpath = img_root / rel
                    if not fpath.is_file():
                        continue
                    fn = os.path.basename(rel)
                    mime = "image/png" if fn.lower().endswith(".png") else "image/jpeg"
                    b64 = base64.b64encode(fpath.read_bytes()).decode()
                    try:
                        vec = omni_embed(args.omni, args.model, [
                            {"type": "image_base64", "image_base64": {"base64": b64, "mime_type": mime}}
                        ])[0]
                    except Exception as e:  # noqa: BLE001
                        print(f"  figure embed failed {rel}: {e}", file=sys.stderr)
                        i_fail += 1
                        continue
                    doc = {
                        "parent_id": pid, "doc_title": title, "chunk_type": "image",
                        "section": "Figure", "page": page_from(fn), "chunk_ordinal": 9000 + i,
                        "content": f"{fn} from {title}", "media_path": rel,
                        **marks, "embedding": vec,
                    }
                    _id = f"{pid}-{fn}"
                    lines.append(json.dumps({"index": {"_id": _id}}).encode() + b"\n")
                    lines.append(json.dumps(doc).encode() + b"\n")
                    n_img += 1
                ok, fail = bulk_post(args.es, args.index, auth_header, lines)
                i_ok += ok
                i_fail += fail
                if n_img and n_img % 200 == 0:
                    print(f"  figures={n_img} ok={i_ok} fail={i_fail}")
        print(f"  figures done: {n_img} · ok={i_ok} fail={i_fail}")
    else:
        print(f"  (no {images_path}; skipping figures)")

    # refresh
    try:
        _req(f"{args.es}/{args.index}/_refresh", b"", auth_header, timeout=30)
    except Exception:
        pass
    print(f"\n✅ pmc-unstructured: {n_ok} text + {i_ok} figure docs in {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
