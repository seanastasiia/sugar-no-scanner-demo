import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ExternalCatalogProduct } from "../src/server/external-catalog-types";
import {
  isLatviaOpenFoodFactsRecord,
  openFoodFactsBulkRecordToProduct,
  type OpenFoodFactsBulkRecord
} from "../src/server/open-food-facts-bulk";

interface SearchResponse {
  count?: number;
  page?: number;
  page_count?: number;
  products?: OpenFoodFactsBulkRecord[];
}

const outputPath = path.resolve(process.env.OFF_LATVIA_OUTPUT || "data/open-food-facts-lv.generated.json");
const limit = Math.max(1, Number.parseInt(process.env.OFF_LATVIA_LIMIT || "500", 10));
const pageSize = Math.min(100, Math.max(10, Number.parseInt(process.env.OFF_LATVIA_PAGE_SIZE || "100", 10)));
const spacingMs = Math.max(6_500, Number.parseInt(process.env.OFF_LATVIA_REQUEST_SPACING_MS || "6500", 10));
const checkedAt = process.env.CATALOG_CHECKED_AT || new Date().toISOString();
const apiBase = process.env.OFF_API_BASE_URL?.trim() || "https://world.openfoodfacts.org";
const fallbackApiBase = process.env.OFF_API_FALLBACK_URL?.trim() || "https://world.openfoodfacts.net";
const userAgent = "Sugar.no Latvia catalog sync/0.1 (https://sugar.no)";

const fields = [
  "code",
  "product_name",
  "product_name_lv",
  "product_name_en",
  "product_name_ru",
  "product_name_lt",
  "product_name_et",
  "product_name_fr",
  "product_name_de",
  "product_name_pl",
  "product_name_bg",
  "product_name_ro",
  "product_name_cs",
  "product_name_es",
  "brands",
  "quantity",
  "categories",
  "countries",
  "countries_tags",
  "image_front_url",
  "nutrition_data_per",
  "nutriments"
].join(",");

async function pause() {
  await new Promise((resolve) => setTimeout(resolve, spacingMs));
}

function searchUrl(base: string, page: number): string {
  const url = new URL("/api/v2/search", base);
  url.searchParams.set("countries_tags_en", "latvia");
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));
  url.searchParams.set("sort_by", "popularity_key");
  url.searchParams.set("fields", fields);
  return url.href;
}

async function fetchPage(page: number): Promise<SearchResponse> {
  let lastError = "unknown error";
  for (const base of [apiBase, fallbackApiBase]) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(searchUrl(base, page), {
          headers: { "user-agent": userAgent },
          signal: AbortSignal.timeout(30_000)
        });
        if (response.ok) return (await response.json()) as SearchResponse;
        lastError = `${base}: HTTP ${response.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
      await pause();
    }
  }
  throw new Error(`Open Food Facts page ${page}: ${lastError}`);
}

async function writeJsonAtomic(value: unknown) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, "utf8");
  await rename(temporary, outputPath);
}

async function main() {
  if (limit > 500) {
    throw new Error("OFF_LATVIA_LIMIT above 500 is not allowed for API sync; use catalog:import:off with the official daily JSONL export");
  }
  const products = new Map<string, ExternalCatalogProduct>();
  let page = 1;
  let expectedPages = 1;
  do {
    const response = await fetchPage(page);
    // Mirrors can report different totals while their indexes refresh. Never
    // let a fallback response shorten a sync that has already seen a larger
    // official count.
    expectedPages = Math.max(expectedPages, 1, Math.ceil((response.count || response.page_count || 0) / pageSize));
    for (const record of response.products || []) {
      if (!isLatviaOpenFoodFactsRecord(record)) continue;
      const product = openFoodFactsBulkRecordToProduct(record, checkedAt);
      if (product) products.set(product.sourceProductId, product);
      if (limit > 0 && products.size >= limit) break;
    }
    console.log(`Open Food Facts Latvia: page ${page}/${expectedPages}; ${products.size} complete products`);
    if (limit > 0 && products.size >= limit) break;
    page += 1;
    if (page <= expectedPages) await pause();
  } while (page <= expectedPages);

  const sorted = [...products.values()].sort((left, right) => left.sourceProductId.localeCompare(right.sourceProductId));
  await writeJsonAtomic(sorted);
  console.log(`Wrote ${sorted.length} ODbL products to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
