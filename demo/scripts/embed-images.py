#!/usr/bin/env python3
"""Pre-compute CLIP embeddings for grape disease images via Ollama."""

import argparse
import base64
import json
import sys
import time
from pathlib import Path

try:
    import httpx
except ImportError:
    print("Install httpx: pip install httpx")
    sys.exit(1)


OLLAMA_URL = "http://192.168.1.10:11434"
EMBED_MODEL = "nomic-embed-text"  # Replace with CLIP model when available
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def embed_image_text(description: str, client: httpx.Client) -> list:
    """Embed image description text (fallback when no CLIP model available)."""
    resp = client.post(
        f"{OLLAMA_URL}/api/embed",
        json={"model": EMBED_MODEL, "input": description},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["embeddings"][0]


def process_images(input_dirs: list, output_path: Path, resume: bool = True):
    """Walk image directories, compute embeddings, output JSONL."""
    # Load already-processed images for resume
    processed = set()
    if resume and output_path.exists():
        with open(output_path) as f:
            for line in f:
                doc = json.loads(line)
                processed.add(doc.get("image_path", ""))
        print(f"  Resuming: {len(processed)} images already processed")

    # Collect all images
    images = []
    for input_dir in input_dirs:
        input_dir = Path(input_dir)
        if not input_dir.exists():
            print(f"  Skipping {input_dir} (not found)")
            continue
        for ext in IMAGE_EXTENSIONS:
            images.extend(input_dir.rglob(f"*{ext}"))

    images = [img for img in images if str(img) not in processed]
    print(f"  Found {len(images)} new images to process")

    if not images:
        print("  Nothing to do.")
        return

    count = 0
    errors = 0
    mode = "a" if resume and output_path.exists() else "w"

    with httpx.Client(timeout=60) as client, open(output_path, mode) as out:
        for img_path in images:
            try:
                # Derive classification from directory name
                classification = img_path.parent.name
                vineyard_id = "grape-disease-dataset"

                # Use text description as embedding input (CLIP fallback)
                description = f"Grape leaf image classified as {classification}"
                embedding = embed_image_text(description, client)

                doc = {
                    "timestamp": "2024-01-01T00:00:00Z",
                    "vineyard_id": vineyard_id,
                    "block_id": "disease-ref",
                    "source": "historical",
                    "image_path": str(img_path),
                    "image_type": "leaf",
                    "classification": classification,
                    "confidence": 1.0,
                    "description": description,
                    "image_embedding": embedding,
                }
                out.write(json.dumps(doc) + "\n")
                count += 1

                if count % 100 == 0:
                    print(f"    {count}/{len(images)} embedded...")

            except Exception as e:
                errors += 1
                if errors <= 5:
                    print(f"    Error on {img_path.name}: {e}")
                elif errors == 6:
                    print("    (suppressing further errors...)")

    print(f"  Done: {count} embedded, {errors} errors → {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Pre-compute image embeddings")
    parser.add_argument(
        "--input",
        nargs="+",
        type=Path,
        default=[
            Path(__file__).parent.parent / "data" / "raw" / "grape-disease",
            Path(__file__).parent.parent / "data" / "raw" / "plantvillage-grape",
        ],
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent.parent / "data" / "preprocessed" / "grape-embeddings.jsonl",
    )
    parser.add_argument("--ollama-url", default=OLLAMA_URL)
    parser.add_argument("--model", default=EMBED_MODEL)
    parser.add_argument("--no-resume", action="store_true")
    args = parser.parse_args()

    global OLLAMA_URL, EMBED_MODEL
    OLLAMA_URL = args.ollama_url
    EMBED_MODEL = args.model

    args.output.parent.mkdir(parents=True, exist_ok=True)
    process_images(args.input, args.output, resume=not args.no_resume)


if __name__ == "__main__":
    main()
