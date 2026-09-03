import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assessPersonalShelfProduct, shelfCategory, type ShelfEvidence, type ShelfCategory } from "../src/lib/personal-shelf-rank";
import { parseBarboraProductPage } from "../src/server/barbora-catalog";
import { barboraShelfEvidence, livinnShelfEvidence } from "../src/server/personal-shelf-parser";
import type { ExternalCatalogProduct } from "../src/server/external-catalog-types";
import type { BarboraNutritionIndexProduct } from "../src/server/barbora-nutrition-index";

const file = resolve("data/personal-shelf-evidence.generated.json");
const apply = process.argv.includes("--apply");
const previous: ShelfEvidence[] = JSON.parse(await readFile(file, "utf8"));
const existingIds = new Set(previous.map((row) => row.productId));
const requestedIds = new Set((process.env.SHELF_PILOT_IDS || "").split(",").filter(Boolean));
const limit = Number(process.env.SHELF_PILOT_PER_CATEGORY || 20);
if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("SHELF_PILOT_PER_CATEGORY must be 1..100");
const livinn: ExternalCatalogProduct[] = JSON.parse(await readFile("data/livinn-catalog.generated.json", "utf8"));
const barbora: BarboraNutritionIndexProduct[] = JSON.parse(await readFile("data/barbora-nutrition-index.generated.json", "utf8"));
const candidates = [
  ...livinn.map((p) => ({ id: `livinn_lt:${p.sourceProductId}`, sku: p.sourceProductId, source: "livinn_lt" as const, url: p.url, category: shelfCategory(p.category) })),
  ...barbora.filter((p) => !p.isAdult).map((p) => ({ id: `barbora:${p.slug}`, sku: p.slug, source: "barbora_lv" as const, url: `https://barbora.lv/produkti/${p.slug}`, category: shelfCategory(p.category) }))
];
const counts = new Map<ShelfCategory, number>();
const selected = candidates.filter((p) => {
  if (requestedIds.size) return requestedIds.has(p.id);
  if (process.argv.includes("--refresh-existing")) return existingIds.has(p.id);
  if (process.argv.includes("--new-only") && existingIds.has(p.id)) return false;
  if (!p.category || (counts.get(p.category) || 0) >= limit) return false;
  counts.set(p.category, (counts.get(p.category) || 0) + 1);
  return true;
});
console.log(JSON.stringify({ apply, requests: selected.length, perCategory: Object.fromEntries(counts) }));
if (!apply) process.exit(0);
const rows = new Map(previous.map((row) => [row.productId, row]));
let fetched = 0;
let failed = 0;
for (const item of selected) {
  try {
    const expectedHost = item.source === "livinn_lt" ? "www.livinn.lt" : "barbora.lv";
    if (new URL(item.url).hostname !== expectedHost) throw new Error("Unexpected source host");
    const response = await fetch(item.url, { headers: { "user-agent": "Sugar.no composition pilot/0.1 (https://sugar.no)" }, signal: AbortSignal.timeout(12000) });
    if (!response.ok || new URL(response.url).hostname !== expectedHost) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const checkedAt = new Date().toISOString();
    const page = item.source === "barbora_lv" ? parseBarboraProductPage(html) : null;
    if (page && page.Url !== item.sku) throw new Error("Exact SKU changed");
    const row = page ? barboraShelfEvidence(page, checkedAt) : livinnShelfEvidence(html, item.url, item.sku, checkedAt);
    if (!row) throw new Error("Missing exact labelled evidence");
    rows.set(item.id, row);
    fetched++;
  } catch (error) {
    failed++;
    console.warn(JSON.stringify({ id: item.id, error: error instanceof Error ? error.message : "source unavailable" }));
  }
  if ((fetched + failed) % 10 === 0) console.log(JSON.stringify({ fetched, failed }));
  await new Promise((resolve) => setTimeout(resolve, 700));
}
const result = [...rows.values()].sort((a, b) => a.productId.localeCompare(b.productId));
await writeFile(file, JSON.stringify(result, null, 2) + "\n");
const report = result.map((evidence) => assessPersonalShelfProduct({ id: evidence.productId, gtin: evidence.gtin, category: evidence.category, format: "other", shelfEvidence: evidence }));
console.log(JSON.stringify({ fetched, failed, evidenceRows: result.length, scored: report.filter((r) => r.status === "scored").length, missing: report.filter((r) => r.status === "missing_data").length, unsupported: report.filter((r) => r.status === "unsupported").length }));
