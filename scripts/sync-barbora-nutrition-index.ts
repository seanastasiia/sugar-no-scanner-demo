import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BarboraNutritionIndexProduct } from "../src/server/barbora-nutrition-index";
import type { BarboraNutrient, BarboraPageProduct } from "../src/server/barbora-catalog";

const outputPath = path.resolve("data/barbora-nutrition-index.generated.json");
const checkpointPath = path.resolve("data/.barbora-nutrition-index.checkpoint.json");
const foodIndexPath = path.resolve("data/barbora-food-product-index.generated.json");
const concurrency = Math.min(6, Math.max(1, Number.parseInt(process.env.BARBORA_SYNC_CONCURRENCY || "3", 10)));
const limit = Number.parseInt(process.env.BARBORA_SYNC_LIMIT || "0", 10);
const checkedAt = process.env.CATALOG_CHECKED_AT || new Date().toISOString();
const requestSpacingMs = Math.max(100, Number.parseInt(process.env.BARBORA_SYNC_REQUEST_SPACING_MS || "180", 10));
const indexOnly = process.env.BARBORA_SYNC_INDEX_ONLY === "1";
const pruneOnly = process.env.BARBORA_SYNC_PRUNE_ONLY === "1";
const foodRoots = [
  "piena-produkti-un-olas",
  "augli-un-darzeni",
  "maize-un-konditorejas-izstradajumi",
  "gala-zivs-un-gatava-kulinarija",
  "bakaleja",
  "saldeta-partika",
  "dzerieni",
  "zidainu-un-bernu-preces"
];

interface Checkpoint {
  completed: string[];
  products: BarboraNutritionIndexProduct[];
}

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function nutrientAmount(nutrients: BarboraNutrient[] | undefined, name: string, unit: string): number | null {
  const nutrient = nutrients?.find((candidate) => normalize(candidate.Name).includes(normalize(name)));
  const amount = nutrient?.Amounts.find((candidate) => normalize(candidate.UnitName).includes(normalize(unit)))?.Amount;
  return typeof amount === "number" && Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function energyKcal(nutrients: BarboraNutrient[] | undefined): number | null {
  const kcal = nutrientAmount(nutrients, "energetiska vertiba", "kcal");
  if (kcal !== null) return kcal;
  const kilojoules = nutrientAmount(nutrients, "energetiska vertiba", "kj");
  return kilojoules === null ? null : Math.round((kilojoules / 4.184) * 10) / 10;
}

function packSize(product: BarboraPageProduct): string {
  const fromTitle = product.title.match(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|cl)\b/i)?.[0];
  if (fromTitle) return fromTitle;
  const attribute = product.attributes?.list?.find((candidate) =>
    normalize(candidate.id).includes("neto daudzums")
  )?.value;
  return attribute || "";
}

function toIndexProduct(product: BarboraPageProduct): BarboraNutritionIndexProduct | null {
  const energy = energyKcal(product.nutrients);
  const protein = nutrientAmount(product.nutrients, "olbaltumvielas", "g");
  const carbohydrate = nutrientAmount(product.nutrients, "oglhidrati", "g");
  const sugar = nutrientAmount(product.nutrients, "cukuri", "g");
  if (energy === null || protein === null || sugar === null || energy <= 0 || product.status === "inactive") return null;
  return {
    slug: product.Url,
    title: product.title,
    brand: product.brand_name || "Barbora",
    category: product.category_name_full_path || product.root_category_id || null,
    packSize: packSize(product),
    nutritionBasis: product.comparative_unit?.toLowerCase() === "l" ? "100ml" : "100g",
    energyKcal: energy,
    proteinG: protein,
    carbohydrateG: carbohydrate,
    totalSugarG: sugar,
    imageUrl: product.image || null,
    isAdult: Boolean(product.is_adult),
    checkedAt
  };
}

let requestGate = Promise.resolve();

async function waitForRequestSlot(): Promise<void> {
  const previous = requestGate;
  let release: () => void = () => undefined;
  requestGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  await new Promise((resolve) => setTimeout(resolve, requestSpacingMs));
  release();
}

async function fetchText(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await waitForRequestSlot();
      const response = await fetch(url, {
        headers: { "user-agent": "Sugar.no Latvia catalog research demo/0.1" },
        signal: AbortSignal.timeout(15_000)
      });
      if (response.status === 404) return null;
      if (response.status === 429) {
        const retryAfterSeconds = Number.parseInt(response.headers.get("retry-after") || "15", 10);
        await new Promise((resolve) => setTimeout(resolve, Math.min(60, Math.max(5, retryAfterSeconds)) * 1_000));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    } catch (error) {
      if (attempt === 7) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw new Error(`${url} could not be fetched after retries`);
}

async function fetchProduct(slug: string): Promise<BarboraPageProduct | null> {
  const html = await fetchText(`https://barbora.lv/produkti/${slug}`);
  if (!html) return null;
  const match = html.match(/window\.product = (\{.*?\});/s);
  return match ? (JSON.parse(match[1]) as BarboraPageProduct) : null;
}

interface BarboraListProduct {
  Url: string;
  is_adult?: boolean;
  status?: string;
  category_path_url?: string;
}

function belongsToFoodShelf(root: string, product: BarboraListProduct): boolean {
  if (root !== "zidainu-un-bernu-preces") return true;
  const path = product.category_path_url || "";
  return [
    "/piena-maisijumi",
    "/galas-un-darzenu-biezenisi",
    "/saldie-biezenisi-un-deserti",
    "/putras-berniem",
    "/dzerieni-un-uzkodas-berniem"
  ].some((segment) => path.includes(segment));
}

async function syncFoodSlugs(): Promise<string[]> {
  const collected = new Set<string>();
  for (const root of foodRoots) {
    for (let page = 1; page <= 250; page += 1) {
      const separator = page === 1 ? "" : `?page=${page}`;
      const html = await fetchText(`https://barbora.lv/${root}${separator}`);
      const match = html?.match(/window\.b_productList = (\[.*?\]);/s);
      if (!match) throw new Error(`Could not read Barbora product list for ${root} page ${page}`);
      const listed = JSON.parse(match[1]) as BarboraListProduct[];
      if (!listed.length) break;
      listed
        .filter(
          (product) =>
            !product.is_adult &&
            product.status !== "inactive" &&
            product.Url &&
            belongsToFoodShelf(root, product)
        )
        .forEach((product) => collected.add(product.Url));
    }
    console.log(`Indexed ${collected.size} active non-adult food products after ${root}`);
  }
  const sorted = [...collected].sort();
  await writeJsonAtomic(foodIndexPath, sorted);
  return sorted;
}

async function readCheckpoint(): Promise<Checkpoint> {
  try {
    return JSON.parse(await readFile(checkpointPath, "utf8")) as Checkpoint;
  } catch {
    return { completed: [], products: [] };
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

async function main() {
  await mkdir(path.dirname(outputPath), { recursive: true });
  if (pruneOnly) {
    const activeFoodSlugs = new Set(JSON.parse(await readFile(foodIndexPath, "utf8")) as string[]);
    const current = JSON.parse(await readFile(outputPath, "utf8")) as BarboraNutritionIndexProduct[];
    const active = current.filter((product) => activeFoodSlugs.has(product.slug));
    await writeJsonAtomic(outputPath, active);
    console.log(`Pruned ${current.length - active.length} stale products; ${active.length} automatic-fit products remain`);
    return;
  }
  const slugs = await syncFoodSlugs();
  if (indexOnly) {
    console.log(`Wrote ${slugs.length} active non-adult food products to ${foodIndexPath}`);
    return;
  }
  const checkpoint = await readCheckpoint();
  const completed = new Set(checkpoint.completed);
  const products = new Map(checkpoint.products.map((product) => [product.slug, product]));
  const pending = slugs.filter((slug) => !completed.has(slug)).slice(0, limit > 0 ? limit : undefined);
  let cursor = 0;
  let sinceCheckpoint = 0;
  let writingCheckpoint = Promise.resolve();

  async function worker() {
    while (cursor < pending.length) {
      const slug = pending[cursor++];
      const product = await fetchProduct(slug);
      const indexed = product ? toIndexProduct(product) : null;
      if (indexed) products.set(indexed.slug, indexed);
      completed.add(slug);
      sinceCheckpoint += 1;
      if (sinceCheckpoint >= 100) {
        sinceCheckpoint = 0;
        writingCheckpoint = writingCheckpoint.then(async () => {
          await writeJsonAtomic(checkpointPath, { completed: [...completed], products: [...products.values()] });
          console.log(`Processed ${completed.size}/${slugs.length}; ${products.size} products have complete fit data`);
        });
        await writingCheckpoint;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  await writingCheckpoint;
  const sorted = [...products.values()].sort((left, right) => left.slug.localeCompare(right.slug));
  await writeJsonAtomic(outputPath, sorted);
  if (completed.size >= slugs.length) await unlink(checkpointPath).catch(() => undefined);
  console.log(`Wrote ${sorted.length} Barbora products with complete two-factor nutrition to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
