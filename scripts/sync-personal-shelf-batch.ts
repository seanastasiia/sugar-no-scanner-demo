import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assessPersonalShelfProduct, shelfCategory, type ShelfEvidence } from "../src/lib/personal-shelf-rank";
import { barboraShelfEvidence, livinnShelfEvidence, offShelfEvidence, rimiShelfCategory, rimiShelfEvidence } from "../src/server/personal-shelf-parser";
import { parseBarboraProductPage } from "../src/server/barbora-catalog";
import { parseShelfEvidence } from "../src/server/personal-shelf-evidence";
import type { ExternalCatalogProduct } from "../src/server/external-catalog-types";
import type { BarboraNutritionIndexProduct } from "../src/server/barbora-nutrition-index";

// Independent, bounded source queues. No search/model calls; no scan images or user data.
type Candidate = { id: string; sku: string; source: ShelfEvidence["source"]; url: string; gtin: string | null; category: string | null };
const reportOnly = process.argv.includes("--report-only");
const apply = process.argv.includes("--apply") || reportOnly;
const retryFailed = process.argv.includes("--retry-failed");
const refresh = process.argv.includes("--refresh-existing");
const maxPerSource = Number(process.env.SHELF_BATCH_LIMIT_PER_SOURCE || "10000");
if (!Number.isInteger(maxPerSource) || maxPerSource < 1 || maxPerSource > 10000) throw new Error("SHELF_BATCH_LIMIT_PER_SOURCE must be 1..10000");
const json = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, "utf8"));
const retailerFile = "data/personal-shelf-evidence.generated.json";
const offFile = "data/personal-shelf-off-evidence.generated.json";
const previous = [...await json<ShelfEvidence[]>(retailerFile), ...await json<ShelfEvidence[]>(offFile)];
const rows = new Map(previous.map((row) => [row.productId, row]));
const barbora = await json<BarboraNutritionIndexProduct[]>("data/barbora-nutrition-index.generated.json");
const external = [...await json<ExternalCatalogProduct[]>("data/rimi-catalog.generated.json"),
  ...await json<ExternalCatalogProduct[]>("data/livinn-catalog.generated.json"), ...await json<ExternalCatalogProduct[]>("data/open-food-facts-lv.generated.json")];
const candidates: Candidate[] = [
  ...barbora.filter((p) => !p.isAdult).map((p) => ({ id: `barbora:${p.slug}`, sku: p.slug, source: "barbora_lv" as const,
    url: `https://barbora.lv/produkti/${p.slug}`, gtin: null, category: p.category })),
  ...external.filter((p) => ["rimi_lv", "livinn_lt", "open_food_facts"].includes(p.source)).map((p) => ({
    id: `${p.source === "open_food_facts" ? "off" : p.source}:${p.sourceProductId}`, sku: p.sourceProductId,
    source: p.source as ShelfEvidence["source"], url: p.url, gtin: p.gtin,
    category: p.source === "rimi_lv" ? rimiShelfCategory(p.url) : p.category
  }))
];
const selected = [...new Map(candidates.filter((p) => shelfCategory(p.category)).map((p) => [p.id, p])).values()];
const sourceCounts: Record<string, number> = {};
const pending = selected.filter((p) => {
  if (!refresh && rows.has(p.id)) return false;
  if ((sourceCounts[p.source] || 0) >= maxPerSource) return false;
  sourceCounts[p.source] = (sourceCounts[p.source] || 0) + 1;
  return true;
});
console.log(JSON.stringify({ mode: reportOnly ? "report-only" : apply ? "apply" : "dry-run", candidates: selected.length, existingEvidence: rows.size, planned: reportOnly ? 0 : pending.length, bySource: sourceCounts }));
if (!apply) process.exit(0);
await mkdir(".catalog-sync", { recursive: true });
const checkpointPath = resolve(".catalog-sync/personal-shelf-batch-v1.json");
type Attempt = { id: string; ok: boolean; error?: string };
const attempts = new Map<string, Attempt>();
try {
  const saved = await json<{ observations: ShelfEvidence[]; attempts: Attempt[] }>(checkpointPath);
  for (const row of saved.observations) if (parseShelfEvidence(row) && selected.some((p) => p.id === row.productId)) rows.set(row.productId, row);
  for (const attempt of saved.attempts) attempts.set(attempt.id, attempt);
} catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
const jobs = reportOnly ? [] : pending.filter((p) => refresh || !attempts.has(p.id) || (retryFailed && !attempts.get(p.id)!.ok));
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
let checkpointChain = Promise.resolve();
const atomicJson = async (path: string, value: unknown) => {
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2) + "\n");
  await rename(`${path}.tmp`, path);
};
const checkpoint = () => {
  const value = { observations: [...rows.values()], attempts: [...attempts.values()] };
  checkpointChain = checkpointChain.then(() => atomicJson(checkpointPath, value));
  return checkpointChain;
};
const hosts: Record<ShelfEvidence["source"], string[]> = {
  barbora_lv: ["barbora.lv", "www.barbora.lv"], rimi_lv: ["www.rimi.lv", "rimi.lv"],
  livinn_lt: ["www.livinn.lt", "livinn.lt"], open_food_facts: ["world.openfoodfacts.org"]
};
async function fetchEvidence(item: Candidate): Promise<ShelfEvidence> {
  let url = item.source === "open_food_facts" ? `https://world.openfoodfacts.org/api/v2/product/${item.sku}.json` : item.url;
  let body = "";
  for (let redirects = 0; redirects < 4; redirects++) {
    const target = new URL(url);
    if (target.protocol !== "https:" || target.username || target.password || target.port || !hosts[item.source].includes(target.hostname)) throw new Error("Unexpected source host");
    const response = await fetch(url, { redirect: "manual", headers: { "user-agent": "Sugar.no evidence review/1.1 (https://sugar.no)" }, signal: AbortSignal.timeout(15000) });
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.get("location")) {
      url = new URL(response.headers.get("location")!, url).href; continue;
    }
    // Stop this source's queue on rate limiting; never retry earlier than its instruction.
    if (response.status === 429) throw new Error(`HTTP 429; Retry-After ${response.headers.get("retry-after") || "not specified"}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (Number(response.headers.get("content-length") || 0) > 4000000) throw new Error("Source too large");
    body = await response.text();
    if (body.length > 4000000) throw new Error("Source too large");
    break;
  }
  const checkedAt = new Date().toISOString();
  let evidence: ShelfEvidence | null = null;
  if (item.source === "barbora_lv") {
    const product = parseBarboraProductPage(body);
    if (product?.Url !== item.sku) throw new Error("Exact SKU changed");
    evidence = barboraShelfEvidence(product, checkedAt);
  } else if (item.source === "rimi_lv") evidence = rimiShelfEvidence(body, url, item.sku, checkedAt);
  else if (item.source === "livinn_lt") evidence = livinnShelfEvidence(body, url, item.sku, checkedAt);
  else {
    const response = JSON.parse(body);
    if (String(response.product?.code) !== item.sku) throw new Error("Exact barcode changed");
    evidence = offShelfEvidence(response.product, checkedAt);
  }
  if (!evidence || evidence.productId !== item.id || !parseShelfEvidence(evidence)) throw new Error("Missing exact labelled evidence");
  if (item.gtin && evidence.gtin && item.gtin !== evidence.gtin) throw new Error("Source barcode conflict");
  return evidence;
}
let completed = 0;
const started = Date.now();
// One worker per source avoids making a site's rate limit depend on another site's latency.
await Promise.all(Object.keys(hosts).map(async (source) => {
  for (const item of jobs.filter((p) => p.source === source)) {
    try {
      rows.set(item.id, await fetchEvidence(item));
      attempts.set(item.id, { id: item.id, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "source unavailable";
      attempts.set(item.id, { id: item.id, ok: false, error: message });
      console.warn(JSON.stringify({ id: item.id, error: message }));
      if (message.startsWith("HTTP 429")) { await checkpoint(); break; }
    }
    completed++;
    if (completed % 20 === 0) {
      console.log(JSON.stringify({ completed, total: jobs.length, elapsedSeconds: Math.round((Date.now() - started) / 1000) }));
      await checkpoint();
    }
    await sleep(source === "open_food_facts" ? 1000 : 700);
  }
}));
await checkpoint();
const result = [...rows.values()].sort((a, b) => a.productId.localeCompare(b.productId));
await atomicJson(retailerFile, result.filter((row) => row.source !== "open_food_facts"));
await atomicJson(offFile, result.filter((row) => row.source === "open_food_facts"));
const groups: Record<string, Record<string, number>> = {};
for (const e of result) {
  const assessment = assessPersonalShelfProduct({ id: e.productId, gtin: e.gtin, category: e.category, format: "other", shelfEvidence: e });
  const group = groups[e.source] ||= {};
  group[assessment.status] = (group[assessment.status] || 0) + 1;
}
const coverage = Object.fromEntries(Object.keys(hosts).map((source) => {
  const scope = selected.filter((p) => p.source === source);
  const failures = scope.flatMap((p) => { const a = attempts.get(p.id); return a && !a.ok ? [a] : []; });
  return [source, { candidates: scope.length, observations: scope.filter((p) => rows.has(p.id)).length,
    failed: failures.length, unattempted: scope.filter((p) => !rows.has(p.id) && !attempts.has(p.id)).length,
    rateLimited: failures.some((a) => a.error?.startsWith("HTTP 429")) }];
}));
const report = { checkedAt: new Date().toISOString(), candidates: selected.length, observations: rows.size, groups, coverage,
  attempts: [...attempts.values()], elapsedSeconds: Math.round((Date.now() - started) / 1000) };
await atomicJson(".catalog-sync/personal-shelf-batch-report.json", report);
console.log(JSON.stringify({ ...report, attempts: { successful: report.attempts.filter((a) => a.ok).length, failed: report.attempts.filter((a) => !a.ok).length } }));
