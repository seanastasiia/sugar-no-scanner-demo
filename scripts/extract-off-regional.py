"""Bounded HTTP-range extraction of the official OFF food Parquet export.

uv run --no-project --python 3.13 --with pyarrow==21.0.0 python scripts/extract-off-regional.py [--apply]
Only the selected columns and regional rows are read; no images or full dump.
"""
import argparse
import io
import json
import os
from pathlib import Path
import re
import time
from datetime import datetime, timezone
from urllib.request import Request, urlopen

import pyarrow.parquet as pq

parser = argparse.ArgumentParser()
parser.add_argument("--apply", action="store_true")
parser.add_argument("--revision", default="1941efe50ba520cbf935399fc4b7b877391dd537")
parser.add_argument("--gtin-prefixes", default="", help="Optional first-batch code prefixes; market tags are still mandatory")
args = parser.parse_args()
prefixes = args.gtin_prefixes.split(",") if args.gtin_prefixes else []
if any(not re.fullmatch(r"\d{3}", prefix) for prefix in prefixes): raise SystemExit("Expected comma-separated three-digit prefixes")
if not re.fullmatch(r"[a-f0-9]{40}", args.revision):
    raise SystemExit("Expected exact public dataset revision")
started = time.monotonic()
url = f"https://huggingface.co/datasets/openfoodfacts/product-database/resolve/{args.revision}/food.parquet"
output = Path(".catalog-sync/expansion-2026-09-04")
output.mkdir(parents=True, exist_ok=True)


class RangeReader(io.RawIOBase):
    def __init__(self, source):
        self.url, self.pos, self.transferred, self.requests = source, 0, 0, 0
        self.size = None
        self.read_range(0, 8)

    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos

    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else self.size + offset
        if self.pos < 0 or self.pos > self.size: raise ValueError("Seek outside export")
        return self.pos

    def read_range(self, start, count):
        if count == 0: return b""
        if count > 128_000_000 or self.transferred + count > 1_500_000_000 or time.monotonic() - started > 1800:
            raise RuntimeError("Read size, transfer or 30-minute job bound exceeded")
        req = Request(self.url, headers={"Range": f"bytes={start}-{start+count-1}", "User-Agent": "Sugar.no offline regional export/1.0"})
        with urlopen(req, timeout=60) as response:
            match = re.fullmatch(r"bytes (\d+)-(\d+)/(\d+)", response.headers.get("Content-Range", ""))
            if response.status != 206 or not match or int(match[1]) != start or int(match[2]) != start + count - 1:
                raise RuntimeError("Source ignored exact HTTP range; refusing full download")
            self.size = int(match[3])
            payload = response.read(count + 1)
        if len(payload) != count: raise RuntimeError("Incomplete range")
        self.transferred += count
        self.requests += 1
        return payload

    def read(self, count=-1):
        if count < 0: count = self.size - self.pos
        count = min(count, self.size - self.pos)
        payload = self.read_range(self.pos, count)
        self.pos += len(payload)
        return payload


fields = ["code", "brands", "categories", "categories_tags", "countries_tags", "ingredients_text", "lang", "last_modified_t", "product_name", "quantity", "product_quantity_unit", "nutriments", "nutrition_data_per", "no_nutrition_data", "obsolete", "data_quality_errors_tags"]
markets = {"en:latvia", "lv:latvija", "en:lithuania", "lt:lietuva", "en:belarus", "ru:belarus", "be:belarus"}
reader = RangeReader(url)
parquet = pq.ParquetFile(reader, pre_buffer=False)
meta = parquet.metadata
code_column = next(c for c in range(meta.row_group(0).num_columns) if meta.row_group(0).column(c).path_in_schema == "code")
prefix_ranges = [padding + prefix for prefix in prefixes for padding in ["", "0", "00", "000", "0000", "00000", "000000"]]

def scoped_group(group):
    if not prefixes: return True
    stats = meta.row_group(group).column(code_column).statistics
    if not stats or not stats.has_min_max: return True
    return any(str(stats.max) >= prefix and str(stats.min) < prefix + ":" for prefix in prefix_ranges)

groups = [g for g in range(meta.num_row_groups) if scoped_group(g)]
column_bytes = sum(meta.row_group(g).column(c).total_compressed_size for g in range(meta.num_row_groups) for c in range(meta.row_group(g).num_columns) if meta.row_group(g).column(c).path_in_schema.split(".")[0] in fields)
print(json.dumps({"stage": "metadata", "rowGroups": meta.num_row_groups, "scopedGroups": len(groups), "gtinPrefixes": prefixes, "selectedColumnsCompressedBytes": column_bytes}), flush=True)
if column_bytes > 1_200_000_000: raise RuntimeError("Selected columns exceed bounded transfer plan")
candidate = output / "off-parquet-rows.jsonl.tmp"
if args.apply and candidate.exists(): raise RuntimeError("Candidate already exists; inspect prior partial job first")
rows = 0
stream = candidate.open("x", encoding="utf8") if args.apply else None
try:
    for index, group in enumerate(groups):
        identities = parquet.read_row_group(group, columns=["code", "countries_tags"], use_threads=False).to_pylist()
        selected = [i for i, row in enumerate(identities) if markets.intersection(row["countries_tags"] or []) and (not prefixes or any(str(row["code"]).lstrip("0").startswith(prefix) for prefix in prefixes))]
        rows += len(selected)
        if rows > 100_000: raise RuntimeError("Regional row scope exceeded")
        if selected and stream:
            table = parquet.read_row_group(group, columns=fields, use_threads=False)
            for row in table.take(selected).to_pylist():
                stream.write(json.dumps(row, ensure_ascii=False) + "\n")
        if index % 5 == 0 or index == len(groups) - 1:
            print(json.dumps({"stage": "progress", "group": group + 1, "groupsDone": index + 1, "rows": rows, "transferredBytes": reader.transferred, "elapsedSeconds": round(time.monotonic()-started)}), flush=True)
finally:
    if stream: stream.close()
    reader.close()
report = {"revision": args.revision, "checkedAt": datetime.now(timezone.utc).isoformat(), "dataset": "https://huggingface.co/datasets/openfoodfacts/product-database", "sourceUrl": url, "rows": rows, "gtinPrefixes": prefixes, "scopedGroups": len(groups), "selectedColumnsCompressedBytes": column_bytes, "transferredBytes": reader.transferred, "requests": reader.requests, "elapsedSeconds": round(time.monotonic()-started), "license": "ODbL-1.0", "imageColumnsRead": False}
if args.apply:
    os.replace(candidate, output / "off-parquet-rows.jsonl")
    (output / "off-extraction.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
print(json.dumps({"stage": "complete", **report}), flush=True)
