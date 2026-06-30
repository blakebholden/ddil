#!/usr/bin/env python3
"""ingest-multimodal.py — index the 10-doc "search images by typing" track into
jina-multimodal (768-d). Image vectors are embedded app-side via the local omni
server (truncated to 768-d); caption vectors are embedded by Elasticsearch on
ingest through the jina-embed-caption pipeline.

Usage:
  ES_URL=http://192.168.1.20:9200 OMNI_URL=http://192.168.1.20:8081 EP=changeme \
  python3 ingest-multimodal.py --data /data/jina
  # expects <data>/manifest.json and <data>/images/<file>
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import urllib.request
from pathlib import Path


def omni_image_768(omni: str, model: str, b64: str, mime: str) -> list[float]:
    body = json.dumps({
        "input": [{"type": "image_base64", "image_base64": {"base64": b64, "mime_type": mime}}],
        "model": model,
        "dimensions": 768,
    }).encode()
    req = urllib.request.Request(f"{omni.rstrip('/')}/v1/embeddings", data=body,
                                 method="POST", headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=120).read())["data"][0]["embedding"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="/data/jina")
    ap.add_argument("--index", default="jina-multimodal")
    ap.add_argument("--es", default=os.environ.get("ES_URL", "http://192.168.1.20:9200"))
    ap.add_argument("--omni", default=os.environ.get("OMNI_URL", "http://192.168.1.20:8081"))
    ap.add_argument("--model", default=os.environ.get("OMNI_MODEL", "jina-embeddings-v5-omni-small"))
    args = ap.parse_args()

    data = Path(args.data)
    eu, ep = os.environ.get("EU", "elastic"), os.environ.get("EP", "changeme")
    auth = "Basic " + base64.b64encode(f"{eu}:{ep}".encode()).decode()

    manifest = json.loads((data / "manifest.json").read_text())
    lines: list[bytes] = []
    for rec in manifest:
        fn = rec["file"]
        fpath = data / "images" / fn
        if not fpath.is_file():
            print(f"  missing image: {fpath}")
            continue
        mime = "image/png" if fn.lower().endswith(".png") else "image/jpeg"
        vec = omni_image_768(args.omni, args.model, base64.b64encode(fpath.read_bytes()).decode(), mime)
        doc = {"doc_id": rec["id"], "file": fn, "caption": rec["caption"], "image_vector": vec}
        lines.append(json.dumps({"index": {"_id": rec["id"]}}).encode() + b"\n")
        lines.append(json.dumps(doc).encode() + b"\n")

    body = b"".join(lines)
    url = f"{args.es}/{args.index}/_bulk?pipeline=jina-embed-caption&refresh=true"
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Content-Type": "application/x-ndjson", "Authorization": auth})
    resp = json.loads(urllib.request.urlopen(req, timeout=120).read())
    ok = sum(1 for it in resp.get("items", []) if it.get("index", {}).get("status", 500) < 300)
    print(f"✅ jina-multimodal: indexed {ok}/{len(manifest)} docs (caption vectors embedded by ES)")


if __name__ == "__main__":
    main()
