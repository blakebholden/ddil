#!/usr/bin/env python3
"""Convert USDA Cook Farm sensor data to JSONL for vineyard-soil index."""

import argparse
import csv
import json
import math
import sys
from pathlib import Path


def normalize(value: float, min_val: float, max_val: float) -> float:
    if max_val == min_val:
        return 0.0
    return (value - min_val) / (max_val - min_val)


def compute_reading_vector(row: dict) -> list:
    """Compute 8-dim normalized vector: [moisture, temp_6, temp_12, temp_24, EC, depth, hour, day_of_year]."""
    moisture = normalize(float(row.get("soil_moisture_pct", 0)), 0, 100)
    temp6 = normalize(float(row.get("soil_temp_6in_c", 15)), -10, 45)
    temp12 = normalize(float(row.get("soil_temp_12in_c", 15)), -10, 45)
    temp24 = normalize(float(row.get("soil_temp_24in_c", 15)), -10, 45)
    ec = normalize(float(row.get("electrical_conductivity", 0.5)), 0, 5)
    depth = normalize(float(row.get("depth_cm", 30)), 0, 150)
    hour = normalize(float(row.get("hour", 12)), 0, 24)
    day = normalize(float(row.get("day_of_year", 180)), 1, 366)
    return [moisture, temp6, temp12, temp24, ec, depth, hour, day]


def process_cook_farm_csv(input_path: Path, output_path: Path):
    """Process Cook Farm CSV files into JSONL."""
    count = 0
    with open(output_path, "w") as out:
        for csv_file in sorted(input_path.glob("*.csv")):
            print(f"  Processing: {csv_file.name}")
            with open(csv_file) as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        doc = {
                            "timestamp": row.get("Date", row.get("date", row.get("datetime", "2010-01-01T00:00:00Z"))),
                            "vineyard_id": "cook-farm",
                            "block_id": row.get("Field", row.get("field", "A")),
                            "station_id": row.get("Station", row.get("station", row.get("ID", "unknown"))),
                            "source": "historical",
                            "soil_moisture_pct": float(row.get("VWC_30", row.get("Moisture", row.get("vwc", 0)))),
                            "depth_cm": int(row.get("Depth", 30)),
                        }

                        # Optional fields
                        for key, field in [
                            ("Temp_30", "soil_temp_6in_c"),
                            ("Temp_60", "soil_temp_12in_c"),
                            ("Temp_90", "soil_temp_24in_c"),
                            ("EC", "electrical_conductivity"),
                        ]:
                            if key in row and row[key]:
                                try:
                                    doc[field] = float(row[key])
                                except (ValueError, TypeError):
                                    pass

                        # Extract time features for vector
                        timestamp = doc["timestamp"]
                        doc["hour"] = 12  # default
                        doc["day_of_year"] = 180  # default

                        doc["reading_vector"] = compute_reading_vector(doc)

                        # Remove temp fields not in schema
                        doc.pop("hour", None)
                        doc.pop("day_of_year", None)

                        out.write(json.dumps(doc) + "\n")
                        count += 1

                        if count % 50000 == 0:
                            print(f"    {count:,} records processed...")

                    except (ValueError, KeyError, TypeError) as e:
                        continue

    print(f"  Total: {count:,} records → {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Preprocess USDA Cook Farm data")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path(__file__).parent.parent / "data" / "raw" / "cook-farm",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent.parent / "data" / "preprocessed" / "soil-readings.jsonl",
    )
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Input directory not found: {args.input}")
        print("Run download-datasets.sh first, or provide --input path")
        sys.exit(1)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    process_cook_farm_csv(args.input, args.output)


if __name__ == "__main__":
    main()
