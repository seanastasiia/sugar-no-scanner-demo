import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ExternalCatalogProduct } from "../src/server/external-catalog-types";
import { parseLivinProductPage, parseRimiProductPage } from "../src/server/retailer-page-parser";

type Source = "rimi" | "livin";

const source = (process.env.RETAILER_SYNC_SOURCE || process.argv[2]) as Source;
if (!(["rimi", "livin"] as string[]).includes(source)) {
  throw new Error("Set RETAILER_SYNC_SOURCE=rimi|livin or pass rimi|livin as the first argument");
}

const limit = Math.max(0, Number.parseInt(process.env.RETAILER_SYNC_LIMIT || "0", 10));
const maxFetches = Math.max(limit || 0, Number.parseInt(process.env.RETAILER_SYNC_MAX_FETCHES || (limit ? String(limit * 8) : "0"), 10));
const spacingMs = Math.max(250, Number.parseInt(process.env.RETAILER_SYNC_REQUEST_SPACING_MS || "450", 10));
const checkedAt = process.env.CATALOG_CHECKED_AT || new Date().toISOString();
const outputPath = path.resolve(`data/${source}-catalog.generated.json`);
const userAgent = "Sugar.no Latvia catalog research/0.1 (https://sugar.no)";

let requestGate = Promise.resolve();

async function waitForSlot() {
  const previous = requestGate;
  let release: () => void = () => undefined;
  requestGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  await new Promise((resolve) => setTimeout(resolve, spacingMs));
  release();
}

async function fetchText(url: string): Promise<string> {
  await waitForSlot();
  const response = await fetch(url, { headers: { "user-agent": userAgent }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

function sitemapLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) =>
    match[1].trim().replaceAll("&amp;", "&")
  );
}

async function productUrls(): Promise<string[]> {
  if (source === "livin") {
    return sitemapLocations(await fetchText("https://www.livin.lv/sitemap/products.xml"))
      .filter((url) => url.startsWith("https://www.livin.lv/p/"));
  }
  const root = sitemapLocations(await fetchText("https://www.rimi.lv/e-veikals/sitemap.xml"))
    .filter((url) => /Product_lv_\d+\.xml$/i.test(url));
  const nested = await Promise.all(root.map(fetchText));
  return nested.flatMap(sitemapLocations).filter((url) => /\/e-veikals\/lv\/produkti\/.+\/p\/\d+/i.test(url));
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, "utf8");
  await rename(temporary, filePath);
}

async function main() {
  const urls = await productUrls();
  const products: ExternalCatalogProduct[] = [];
  const cap = maxFetches > 0 ? Math.min(maxFetches, urls.length) : urls.length;
  for (let index = 0; index < cap; index += 1) {
    const url = urls[index];
    try {
      const html = await fetchText(url);
      const product = source === "rimi"
        ? parseRimiProductPage(html, url, checkedAt)
        : parseLivinProductPage(html, url, checkedAt);
      if (product) products.push(product);
      if (limit > 0 && products.length >= limit) break;
    } catch (error) {
      console.warn(error instanceof Error ? error.message : String(error));
    }
    if ((index + 1) % 50 === 0) console.log(`${source}: checked ${index + 1}/${cap}; ${products.length} complete products`);
  }
  products.sort((left, right) => left.sourceProductId.localeCompare(right.sourceProductId));
  await writeJsonAtomic(outputPath, products);
  console.log(`Wrote ${products.length} ${source} products with protein and total sugar to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
