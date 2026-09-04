"""Stream the official version-pinned CSV; retain regional rows, not the dump.

python3 scripts/extract-off-regional-csv.py --apply
CSV lacks reliable ingredient language/translated names: these remain unknown.
"""
import argparse
import csv
from datetime import datetime, timezone
import gzip
import io
import json
import math
import os
from pathlib import Path
import time
from urllib.request import Request, urlopen
from off_tsv import complete_row, daily_export_reader

parser = argparse.ArgumentParser()
parser.add_argument("--apply", action="store_true")
args = parser.parse_args()
version = "ssk8Chy4rIudQaZJLMXPc5pF7SrBQzAM"
url = "https://openfoodfacts-ds.s3.eu-west-3.amazonaws.com/en.openfoodfacts.org.products.csv.gz?versionId=" + version
if not args.apply:
    print(json.dumps({"sourceUrl": url, "maxCompressedBytes": 1_400_000_000, "markets": ["latvia", "lithuania", "belarus"], "ingredientLanguage": None}))
    raise SystemExit(0)
started = time.monotonic()
directory = Path(".catalog-sync/expansion-2026-09-04")
directory.mkdir(parents=True, exist_ok=True)
candidate = directory / "off-csv-rows.jsonl.tmp"
markets = {"en:latvia", "lv:latvija", "en:lithuania", "lt:lietuva", "en:belarus", "ru:belarus", "be:belarus"}
nutrients = ["energy-kcal", "energy-kj", "proteins", "sugars", "carbohydrates", "fiber", "salt", "sodium", "saturated-fat", "fat"]
csv.field_size_limit(2_000_000)
scanned = kept = malformed = 0
def number(text):
    try:
        n = float(text)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError): return None

with urlopen(Request(url, headers={"User-Agent": "Sugar.no offline regional export/1.0"}), timeout=60) as response:
    size = int(response.headers.get("Content-Length", "0"))
    if response.status != 200 or not 0 < size <= 1_400_000_000 or response.headers.get("x-amz-version-id") != version:
        raise RuntimeError("Unexpected source version or download size")
    with gzip.GzipFile(fileobj=response) as compressed, io.TextIOWrapper(compressed, encoding="utf8", newline="") as text, candidate.open("x", encoding="utf8") as output:
        # The daily export_database.pl writes sanitized tab-separated fields,
        # not quote-delimited CSV. Quotes in a product name are literal data.
        # https://github.com/openfoodfacts/openfoodfacts-server/blob/main/scripts/export_database.pl
        reader = daily_export_reader(text)
        for row in reader:
            scanned += 1
            if not complete_row(row):
                malformed += 1
                continue  # Never shift a malformed line's nutrition columns.
            if scanned % 100_000 == 0:
                print(json.dumps({"stage": "progress", "scanned": scanned, "regionalRows": kept, "elapsedSeconds": round(time.monotonic()-started)}), flush=True)
                if time.monotonic()-started > 1800: raise RuntimeError("30-minute stream budget exceeded")
            tags = row["countries_tags"].split(",")
            if not markets.intersection(tags): continue
            kept += 1
            if kept > 100_000: raise RuntimeError("Regional row limit exceeded")
            record = {"code": row["code"], "brands": row.get("brands"), "categories": row.get("categories"), "categories_tags": row.get("categories_tags", "").split(","), "countries_tags": tags,
                "lang": None, "product_name": [{"lang": "main", "text": row.get("product_name", "")}],
                "ingredients_text": [{"lang": "main", "text": row.get("ingredients_text", "")}],
                "quantity": row.get("quantity"), "product_quantity_unit": None, "nutrition_data_per": "100g",
                "nutriments": [{"name": name, "100g": number(row.get(name + "_100g"))} for name in nutrients],
                "no_nutrition_data": row.get("no_nutrition_data") in ("on", "1", "true"),
                "data_quality_errors_tags": list(filter(None, row.get("data_quality_errors_tags", "").split(","))), "last_modified_t": number(row.get("last_modified_t"))}
            output.write(json.dumps(record, ensure_ascii=False) + "\n")
report = {"format": "csv", "revision": version, "sourceUrl": url, "rows": kept, "scanned": scanned, "malformedRowsSkipped": malformed, "compressedBytes": size,
    "checkedAt": datetime.now(timezone.utc).isoformat(), "elapsedSeconds": round(time.monotonic()-started), "license": "ODbL-1.0",
    "imagesDownloaded": False, "ingredientLanguageAvailable": False, "translatedNamesAvailable": False}
os.replace(candidate, directory / "off-parquet-rows.jsonl")
(directory / "off-extraction.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
print(json.dumps({"stage": "complete", **report}), flush=True)
