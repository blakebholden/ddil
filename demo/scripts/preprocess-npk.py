#!/usr/bin/env python3
"""Convert Kaggle Crop Recommendation CSV to JSONL for vineyard-npk index."""

import argparse
import csv
import json
import sys
from pathlib import Path


def normalize(value: float, min_val: float, max_val: float) -> float:
    if max_val == min_val:
        return 0.0
    return (value - min_val) / (max_val - min_val)


def compute_npk_vector(row: dict) -> list:
    """Compute 7-dim normalized vector: [N, P, K, temp, humidity, pH, rainfall]."""
    return [
        normalize(float(row["N"]), 0, 140),
        normalize(float(row["P"]), 5, 145),
        normalize(float(row["K"]), 5, 205),
        normalize(float(row["temperature"]), 8, 44),
        normalize(float(row["humidity"]), 14, 100),
        normalize(float(row["ph"]), 3.5, 9.5),
        normalize(float(row["rainfall"]), 20, 300),
    ]


def main():
    parser = argparse.ArgumentParser(description="Preprocess Kaggle Crop Recommendation data")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path(__file__).parent.parent / "data" / "raw" / "crop-recommendation" / "Crop_recommendation.csv",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent.parent / "data" / "preprocessed" / "npk-profiles.jsonl",
    )
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Input file not found: {args.input}")
        print("Run download-datasets.sh first, or provide --input path")
        sys.exit(1)

    args.output.parent.mkdir(parents=True, exist_ok=True)

    count = 0
    with open(args.input) as f, open(args.output, "w") as out:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                doc = {
                    "timestamp": "2024-01-01T00:00:00Z",
                    "vineyard_id": "kaggle-baseline",
                    "block_id": f"sample-{count}",
                    "source": "historical",
                    "soil_nitrogen_mgkg": float(row["N"]),
                    "soil_phosphorus_mgkg": float(row["P"]),
                    "soil_potassium_mgkg": float(row["K"]),
                    "temperature_c": float(row["temperature"]),
                    "humidity_pct": float(row["humidity"]),
                    "ph": float(row["ph"]),
                    "rainfall_mm": float(row["rainfall"]),
                    "crop_suitability": row["label"],
                    "npk_vector": compute_npk_vector(row),
                }
                out.write(json.dumps(doc) + "\n")
                count += 1
            except (ValueError, KeyError) as e:
                continue

    print(f"Processed {count:,} records → {args.output}")
    grape_count = sum(
        1
        for line in open(args.output)
        if '"grapes"' in line.lower() or '"grape"' in line.lower()
    )
    print(f"  ({grape_count} grape-specific entries)")


if __name__ == "__main__":
    main()
