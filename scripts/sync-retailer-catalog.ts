import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ExternalCatalogProduct } from "../src/server/external-catalog-types";
import { parseLivinProductPage, parseRimiProductPage } from "../src/server/retailer-page-parser";

type Source = "rimi" | "livin";

interface SyncProgress {
  source: Source;
  categories: string[] | null;
  startedAt: string;
  checkedAt: string;
  discoveredUrls: number;
  processedUrls: string[];
  notFoundUrls: string[];
  failedUrls: string[];
  products: ExternalCatalogProduct[];
}

interface SyncReport {
  source: Source;
  categories: string[] | null;
  startedAt: string;
  completedAt: string;
  checkedAt: string;
  discoveredUrls: number;
  processedUrls: number;
  completeProducts: number;
  skippedWithoutCompleteNutrition: number;
  notFoundUrls: number;
  failedUrls: number;
  requestSpacingMs: number;
  concurrency: number;
}

class FetchError extends Error {
  constructor(public readonly status: number, url: string) {
    super(`${url}: HTTP ${status}`);
  }
}

const source = (process.env.RETAILER_SYNC_SOURCE || process.argv[2]) as Source;
if (!("rimi livin".split(" ") as string[]).includes(source)) {
  throw new Error("Set RETAILER_SYNC_SOURCE=rimi|livin or pass rimi|livin as the first argument");
}

const limit = positiveInteger(process.env.RETAILER_SYNC_LIMIT, 0);
const maxFetches = Math.max(limit, positiveInteger(process.env.RETAILER_SYNC_MAX_FETCHES, 0));
const spacingMs = Math.max(100, positiveInteger(process.env.RETAILER_SYNC_REQUEST_SPACING_MS, 350));
const concurrency = Math.min(8, Math.max(1, positiveInteger(process.env.RETAILER_SYNC_CONCURRENCY, 4)));
const checkpointEvery = Math.max(10, positiveInteger(process.env.RETAILER_SYNC_CHECKPOINT_EVERY, 250));
const resume = process.env.RETAILER_SYNC_RESUME !== "0";
const checkedAt = process.env.CATALOG_CHECKED_AT || new Date().toISOString();
const outputPath = path.resolve(process.env.RETAILER_SYNC_OUTPUT || `data/${source}-catalog.generated.json`);
const reportPath = path.resolve(process.env.RETAILER_SYNC_REPORT || `data/${source}-catalog-sync-report.generated.json`);
const progressPath = path.resolve(process.env.RETAILER_SYNC_PROGRESS || `.catalog-sync/${source}.progress.json`);
const userAgent = "Sugar.no Latvia catalog research/0.2 (https://sugar.no)";
const defaultRimiCategories = [
  "gala-zivis-un-gatava-kulinarija",
  "piena-produkti-un-olas",
  "maize-un-konditoreja",
  "saldetie-edieni",
  "iepakota-partika",
  "saldumi-un-uzkodas",
  "dzerieni"
];
const configuredRimiCategories = (process.env.RETAILER_SYNC_RIMI_CATEGORIES || defaultRimiCategories.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const rimiCategories = configuredRimiCategories.includes("all") ? null : configuredRimiCategories;

let nextRequestAt = 0;
let requestGate = Promise.resolve();

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForSlot() {
  const previous = requestGate;
  let release: () => void = () => undefined;
  requestGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  const waitMs = Math.max(0, nextRequestAt - Date.now());
  if (waitMs) await delay(waitMs);
  nextRequestAt = Date.now() + spacingMs;
  release();
}

async function fetchText(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await waitForSlot();
      const response = await fetch(url, {
        headers: { "user-agent": userAgent },
        signal: AbortSignal.timeout(25_000)
      });
      if (response.ok) return response.text();
      if (response.status === 404 || response.status === 410) throw new FetchError(response.status, url);
      if (response.status !== 429 && response.status < 500) throw new FetchError(response.status, url);
      const retryAfter = Number.parseInt(response.headers.get("retry-after") || "", 10);
      lastError = new FetchError(response.status, url);
      await delay(Number.isFinite(retryAfter) ? retryAfter * 1_000 : 750 * 2 ** attempt);
    } catch (error) {
      if (error instanceof FetchError && (error.status === 404 || error.status === 410 || error.status < 429)) throw error;
      lastError = error;
      if (attempt < 2) await delay(750 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${url}: request failed`);
}

function sitemapLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) =>
    match[1].trim().replaceAll("&amp;", "&")
  );
}

async function productUrls(): Promise<string[]> {
  if (source === "livin") {
    return [...new Set(sitemapLocations(await fetchText("https://www.livin.lv/sitemap/products.xml"))
      .filter((url) => url.startsWith("https://www.livin.lv/p/")))];
  }
  const root = sitemapLocations(await fetchText("https://www.rimi.lv/e-veikals/sitemap.xml"))
    .filter((url) => /Product_lv_\d+\.xml$/i.test(url));
  const nested = await Promise.all(root.map(fetchText));
  const urls = [...new Set(nested.flatMap(sitemapLocations)
    .filter((url) => /\/e-veikals\/lv\/produkti\/.+\/p\/\d+/i.test(url)))];
  if (!rimiCategories) return urls;
  const allowed = new Set(rimiCategories);
  return urls.filter((url) => {
    const category = new URL(url).pathname.split("/produkti/")[1]?.split("/")[0];
    return category ? allowed.has(category) : false;
  });
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, "utf8");
  await rename(temporary, filePath);
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function dedupeProducts(products: ExternalCatalogProduct[]): ExternalCatalogProduct[] {
  return [...new Map(products.map((product) => [product.sourceProductId, product])).values()]
    .sort((left, right) => left.sourceProductId.localeCompare(right.sourceProductId));
}

async function initialProgress(urls: string[]): Promise<SyncProgress> {
  const expectedCategories = source === "rimi" ? rimiCategories : null;
  const saved = resume ? await readJson<SyncProgress>(progressPath) : null;
  if (saved?.source === source) {
    const currentUrls = new Set(urls);
    return {
      ...saved,
      categories: source === "rimi" ? rimiCategories : null,
      discoveredUrls: urls.length,
      processedUrls: saved.processedUrls.filter((url) => currentUrls.has(url)),
      notFoundUrls: saved.notFoundUrls.filter((url) => currentUrls.has(url)),
      failedUrls: [],
      products: saved.products.filter((product) => currentUrls.has(product.url))
    };
  }
  const existing = resume ? await readJson<ExternalCatalogProduct[]>(outputPath) : null;
  const currentUrls = new Set(urls);
  const existingProducts = existing?.filter(
    (product) => product.source === `${source}_lv` && currentUrls.has(product.url)
  ) || [];
  const completedReport = resume ? await readJson<Partial<SyncReport>>(reportPath) : null;
  if (
    completedReport?.source === source &&
    completedReport.failedUrls === 0 &&
    completedReport.discoveredUrls === urls.length &&
    completedReport.processedUrls === urls.length &&
    JSON.stringify(completedReport.categories ?? null) === JSON.stringify(expectedCategories)
  ) {
    return {
      source,
      categories: expectedCategories,
      startedAt: completedReport.startedAt || new Date().toISOString(),
      checkedAt: completedReport.checkedAt || checkedAt,
      discoveredUrls: urls.length,
      processedUrls: urls,
      notFoundUrls: [],
      failedUrls: [],
      products: existingProducts
    };
  }
  return {
    source,
    categories: expectedCategories,
    startedAt: new Date().toISOString(),
    checkedAt,
    discoveredUrls: urls.length,
    processedUrls: existingProducts.map((product) => product.url),
    notFoundUrls: [],
    failedUrls: [],
    products: existingProducts
  };
}

async function main() {
  const urls = await productUrls();
  const progress = await initialProgress(urls);
  const processed = new Set(progress.processedUrls);
  const notFound = new Set(progress.notFoundUrls);
  const failures = new Set<string>();
  const products = new Map(progress.products.map((product) => [product.sourceProductId, product]));
  const pending = urls.filter((url) => !processed.has(url));
  const capped = maxFetches > 0 ? pending.slice(0, maxFetches) : pending;
  let cursor = 0;
  let completedThisRun = 0;
  let checkpointChain = Promise.resolve();

  console.log(`${source}: discovered ${urls.length} product URLs; ${processed.size} already processed; ${products.size} complete products; ${capped.length} pending`);

  const checkpoint = () => {
    const snapshot: SyncProgress = {
      ...progress,
      discoveredUrls: urls.length,
      processedUrls: [...processed],
      notFoundUrls: [...notFound],
      failedUrls: [...failures],
      products: dedupeProducts([...products.values()])
    };
    checkpointChain = checkpointChain.then(() => writeJsonAtomic(progressPath, snapshot));
  };

  async function worker() {
    while (cursor < capped.length && (limit === 0 || products.size < limit)) {
      const index = cursor;
      cursor += 1;
      const url = capped[index];
      try {
        const html = await fetchText(url);
        const product = source === "rimi"
          ? parseRimiProductPage(html, url, checkedAt)
          : parseLivinProductPage(html, url, checkedAt);
        if (product) products.set(product.sourceProductId, product);
        processed.add(url);
      } catch (error) {
        if (error instanceof FetchError && (error.status === 404 || error.status === 410)) {
          processed.add(url);
          notFound.add(url);
        } else {
          failures.add(url);
          console.warn(error instanceof Error ? error.message : String(error));
        }
      }
      completedThisRun += 1;
      if (completedThisRun % checkpointEvery === 0) checkpoint();
      if (completedThisRun % 100 === 0) {
        console.log(`${source}: checked ${completedThisRun}/${capped.length}; ${products.size} complete products; ${failures.size} transient failures`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  checkpoint();
  await checkpointChain;

  const fullRun = maxFetches === 0 && limit === 0;
  if (fullRun && failures.size > 0) {
    throw new Error(`${source}: ${failures.size} pages still failed after retries; progress retained at ${progressPath}`);
  }

  const output = dedupeProducts([...products.values()]);
  await writeJsonAtomic(outputPath, output);
  const report: SyncReport = {
    source,
    categories: source === "rimi" ? rimiCategories : null,
    startedAt: progress.startedAt,
    completedAt: new Date().toISOString(),
    checkedAt,
    discoveredUrls: urls.length,
    processedUrls: processed.size,
    completeProducts: output.length,
    skippedWithoutCompleteNutrition: Math.max(0, processed.size - notFound.size - output.length),
    notFoundUrls: notFound.size,
    failedUrls: failures.size,
    requestSpacingMs: spacingMs,
    concurrency
  };
  await writeJsonAtomic(reportPath, report);
  if (fullRun) await rm(progressPath, { force: true });
  console.log(`Wrote ${output.length} ${source} products with protein and total sugar to ${outputPath}`);
  console.log(JSON.stringify(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
