import { createReadStream } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { createInterface } from "node:readline";
import path from "node:path";
import type { ExternalCatalogProduct } from "../src/server/external-catalog-types";
import {
  isOpenFoodFactsMarketRecord,
  openFoodFactsBulkRecordToProduct,
  type OpenFoodFactsBulkRecord,
  type OpenFoodFactsMarket
} from "../src/server/open-food-facts-bulk";

const input = process.env.OFF_BULK_INPUT?.trim() || process.argv[2]?.trim();
if (!input) throw new Error("OFF_BULK_INPUT or an input argument is required (.jsonl or .jsonl.gz path/URL)");
const supportedMarkets = new Set<OpenFoodFactsMarket>(["latvia", "lithuania", "belarus"]);
const markets = (process.env.OFF_BULK_MARKETS || "latvia")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean) as OpenFoodFactsMarket[];
if (!markets.length || markets.some((market) => !supportedMarkets.has(market))) {
  throw new Error("OFF_BULK_MARKETS must contain only: latvia,lithuania,belarus");
}
const onlyLatvia = markets.length === 1 && markets[0] === "latvia";
const outputPath = path.resolve(
  process.env.OFF_BULK_OUTPUT ||
  (onlyLatvia ? "data/open-food-facts-lv.generated.json" : "data/open-food-facts-regional.generated.json")
);
const limit = Math.max(0, Number.parseInt(process.env.OFF_BULK_LIMIT || "0", 10));
const checkedAt = process.env.CATALOG_CHECKED_AT || new Date().toISOString();
const fetchTimeoutMs = Math.max(60_000, Number.parseInt(process.env.OFF_BULK_FETCH_TIMEOUT_MS || "1800000", 10));

async function inputStream(): Promise<Readable> {
  if (!/^https?:\/\//i.test(input)) return createReadStream(path.resolve(input));
  const response = await fetch(input, {
    headers: { "user-agent": "Sugar.no OFF bulk importer/0.1 (https://sugar.no)" },
    signal: AbortSignal.timeout(fetchTimeoutMs)
  });
  if (!response.ok || !response.body) throw new Error(`${input}: HTTP ${response.status}`);
  return Readable.fromWeb(response.body as unknown as import("node:stream/web").ReadableStream);
}

async function writeJsonAtomic(value: unknown) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, "utf8");
  await rename(temporary, outputPath);
}

async function main() {
  const raw = await inputStream();
  const stream = /\.gz(?:$|\?)/i.test(input) ? raw.pipe(createGunzip()) : raw;
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  const products = new Map<string, ExternalCatalogProduct>();
  let processed = 0;
  for await (const line of lines) {
    processed += 1;
    let record: OpenFoodFactsBulkRecord;
    try {
      record = JSON.parse(line) as OpenFoodFactsBulkRecord;
    } catch {
      continue;
    }
    if (!isOpenFoodFactsMarketRecord(record, markets)) continue;
    const product = openFoodFactsBulkRecordToProduct(record, checkedAt);
    if (product) products.set(product.sourceProductId, product);
    if (limit > 0 && products.size >= limit) break;
    if (processed % 500_000 === 0) console.log(`Read ${processed} rows; kept ${products.size} products for ${markets.join(", ")}`);
  }
  const sorted = [...products.values()].sort((left, right) => left.sourceProductId.localeCompare(right.sourceProductId));
  await writeJsonAtomic(sorted);
  console.log(`Wrote ${sorted.length} ODbL products for ${markets.join(", ")} to the isolated OFF layer at ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
