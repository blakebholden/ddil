#!/usr/bin/env python3
"""Convert UCI Wine Quality CSV to JSONL for vineyard-wine index."""

import argparse
import csv
import json
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Preprocess UCI Wine Quality data")
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path(__file__).parent.parent / "data" / "raw" / "wine-quality",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent.parent / "data" / "preprocessed" / "wine-quality.jsonl",
    )
    args = parser.parse_args()

    if not args.input_dir.exists():
        print(f"Input directory not found: {args.input_dir}")
        print("Run download-datasets.sh first, or provide --input-dir path")
        sys.exit(1)

    args.output.parent.mkdir(parents=True, exist_ok=True)

    count = 0
    with open(args.output, "w") as out:
        for wine_type, filename in [
            ("red", "winequality-red.csv"),
            ("white", "winequality-white.csv"),
        ]:
            filepath = args.input_dir / filename
            if not filepath.exists():
                print(f"  Skipping {filename} (not found)")
                continue

            print(f"  Processing: {filename}")
            with open(filepath) as f:
                # UCI wine quality uses semicolon delimiter
                reader = csv.DictReader(f, delimiter=";")
                for row in reader:
                    try:
                        doc = {
                            "timestamp": "2024-01-01T00:00:00Z",
                            "wine_type": wine_type,
                            "fixed_acidity": float(row["fixed acidity"]),
                            "volatile_acidity": float(row["volatile acidity"]),
                            "citric_acid": float(row["citric acid"]),
                            "residual_sugar": float(row["residual sugar"]),
                            "chlorides": float(row["chlorides"]),
                            "free_sulfur_dioxide": float(row["free sulfur dioxide"]),
                            "total_sulfur_dioxide": float(row["total sulfur dioxide"]),
                            "density": float(row["density"]),
                            "ph": float(row["pH"]),
                            "sulphates": float(row["sulphates"]),
                            "alcohol": float(row["alcohol"]),
                            "quality": int(row["quality"]),
                        }
                        out.write(json.dumps(doc) + "\n")
                        count += 1
                    except (ValueError, KeyError) as e:
                        continue

    print(f"Total: {count:,} records → {args.output}")


if __name__ == "__main__":
    main()
