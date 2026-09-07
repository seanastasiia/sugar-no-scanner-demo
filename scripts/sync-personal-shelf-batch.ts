import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assessPersonalShelfProduct, shelfCategory, SHELF_CATEGORIES, type ShelfEvidence } from "../src/lib/personal-shelf-rank";
import { barboraShelfEvidence, livinnShelfEvidence, rimiShelfCategory, rimiShelfEvidence } from "../src/server/personal-shelf-parser";
import { exactOffEvidence } from "../src/server/off-exact-evidence";
import { parseBarboraProductPage } from "../src/server/barbora-catalog";
import { parseShelfEvidence } from "../src/server/personal-shelf-evidence";
import type { ExternalCatalogIdentity, ExternalCatalogProduct } from "../src/server/external-catalog-types";
import type { BarboraNutritionIndexProduct } from "../src/server/barbora-nutrition-index";
import { retryBoundaryElapsed, retryNotBefore } from "../src/server/source-retry";

// Independent, bounded source queues. No search/model calls; no scan images or user data.
type Candidate = { id: string; sku: string; source: ShelfEvidence["source"]; url: string; gtin: string | null; category: string | null; offIdentity?: { code: string; brand: string; title: string; aliases?: string[]; packSize: string } };
const reportOnly = process.argv.includes("--report-only");
const apply = process.argv.includes("--apply") || reportOnly;
const retryFailed = process.argv.includes("--retry-failed");
const refresh = process.argv.includes("--refresh-existing");
const resumeOnly = process.env.SHELF_BATCH_RESUME_ONLY === "true";
const maxPerSource = Number(process.env.SHELF_BATCH_LIMIT_PER_SOURCE || "10000");
if (!Number.isInteger(maxPerSource) || maxPerSource < 1 || maxPerSource > 10000) throw new Error("SHELF_BATCH_LIMIT_PER_SOURCE must be 1..10000");
const categoryScope = process.env.SHELF_BATCH_CATEGORIES?.split(",").map((value) => value.trim());
if (categoryScope?.some((value) => !Object.hasOwn(SHELF_CATEGORIES, value))) throw new Error("Unknown SHELF_BATCH_CATEGORIES value");
const json = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, "utf8"));
const retailerFile = process.env.SHELF_BATCH_RETAILER_OUTPUT || "data/personal-shelf-evidence.generated.json";
const offFile = process.env.SHELF_BATCH_OFF_OUTPUT || "data/personal-shelf-off-evidence.generated.json";
const previous = [...await json<ShelfEvidence[]>("data/personal-shelf-evidence.generated.json"), ...await json<ShelfEvidence[]>("data/personal-shelf-off-evidence.generated.json")];
const idScope: unknown = process.env.SHELF_BATCH_IDS_FILE ? await json(process.env.SHELF_BATCH_IDS_FILE) : null;
if (idScope !== null && (!Array.isArray(idScope) || idScope.length < 1 || idScope.length > 10000 ||
  idScope.some((id) => typeof id !== "string" || !/^(?:barbora|rimi_lv|livinn_lt|off):[^\s]+$/.test(id)) || new Set(idScope).size !== idScope.length)) {
  throw new Error("SHELF_BATCH_IDS_FILE must contain 1..10000 distinct canonical IDs");
}
const scopedIds = idScope === null ? null : new Set(idScope as string[]);
const rows = new Map(previous.map((row) => [row.productId, row]));
const sources: ShelfEvidence["source"][] = ["barbora_lv", "rimi_lv", "livinn_lt", "open_food_facts"];
const barbora = await json<BarboraNutritionIndexProduct[]>("data/barbora-nutrition-index.generated.json");
const external: Array<ExternalCatalogProduct | ExternalCatalogIdentity> = [...await json<ExternalCatalogProduct[]>("data/rimi-catalog.generated.json"),
  ...await json<ExternalCatalogIdentity[]>("data/livinn-food-index.generated.json"), ...await json<ExternalCatalogProduct[]>("data/open-food-facts-lv.generated.json"),
  ...await json<ExternalCatalogProduct[]>("data/open-food-facts-regional.generated.json")];
const candidates: Candidate[] = [
  ...barbora.filter((p) => !p.isAdult).map((p) => ({ id: `barbora:${p.slug}`, sku: p.slug, source: "barbora_lv" as const,
    url: `https://barbora.lv/produkti/${p.slug}`, gtin: null, category: p.category })),
  ...external.filter((p) => ["rimi_lv", "livinn_lt", "open_food_facts"].includes(p.source)).map((p) => ({
    id: `${p.source === "open_food_facts" ? "off" : p.source}:${p.sourceProductId}`, sku: p.sourceProductId,
    source: p.source as ShelfEvidence["source"], url: p.url, gtin: p.gtin,
    category: p.source === "rimi_lv" ? rimiShelfCategory(p.url) : p.category,
    ...(p.source === "open_food_facts" ? { offIdentity: { code: p.sourceProductId, brand: p.brand, title: p.title, aliases: p.aliases, packSize: p.packSize } } : {})
  }))
];
const selected = [...new Map(candidates.filter((p) => {
  const category = shelfCategory(p.category);
  return category && (!categoryScope || categoryScope.includes(category)) && (!scopedIds || scopedIds.has(p.id));
}).map((p) => [p.id, p])).values()];
if (scopedIds && selected.length !== scopedIds.size) throw new Error("Scoped IDs contain an unavailable or unsupported candidate");
const sourceCounts: Record<string, number> = {};
const pending = selected.filter((p) => {
  if (!refresh && rows.has(p.id)) return false;
  if ((sourceCounts[p.source] || 0) >= maxPerSource) return false;
  sourceCounts[p.source] = (sourceCounts[p.source] || 0) + 1;
  return true;
});
if (apply) await mkdir(".catalog-sync", { recursive: true });
const checkpointPath = resolve(process.env.SHELF_BATCH_CHECKPOINT || ".catalog-sync/personal-shelf-batch-v1.json");
type Attempt = { id: string; ok: boolean; error?: string; attemptedAt?: string };
const attempts = new Map<string, Attempt>();
const sourceCooldowns: Partial<Record<ShelfEvidence["source"], string>> = {};
try {
  const saved = await json<{ observations: ShelfEvidence[]; attempts: Attempt[]; sourceCooldowns?: Partial<Record<ShelfEvidence["source"], string>> }>(checkpointPath);
  for (const row of saved.observations) {
    const current = rows.get(row.productId);
    if (parseShelfEvidence(row) && selected.some((p) => p.id === row.productId) &&
      (!current || Date.parse(row.checkedAt) > Date.parse(current.checkedAt))) rows.set(row.productId, row);
  }
  for (const attempt of saved.attempts) attempts.set(attempt.id, attempt);
  Object.assign(sourceCooldowns, saved.sourceCooldowns);
  // Old checkpoints did not store an absolute cooldown. Anchor their final 429
  // to the checkpoint mtime once, rather than hammering or postponing forever.
  if (!saved.sourceCooldowns) {
    const checkpointTime = (await stat(checkpointPath)).mtimeMs;
    for (const attempt of saved.attempts.filter((row) => row.error?.startsWith("HTTP 429"))) {
      const source = selected.find((row) => row.id === attempt.id)?.source;
      if (source) sourceCooldowns[source] = retryNotBefore(null, checkpointTime);
    }
  }
} catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
for (const source of Object.keys(sourceCooldowns) as ShelfEvidence["source"][]) {
  if (retryBoundaryElapsed(sourceCooldowns[source])) delete sourceCooldowns[source];
}
const jobs = reportOnly ? [] : pending.filter((p) => !sourceCooldowns[p.source] &&
  (resumeOnly ? !attempts.has(p.id) : refresh || !attempts.has(p.id) || (retryFailed && !attempts.get(p.id)!.ok)));
const plannedBySource = Object.fromEntries(sources.map((source) =>
  [source, jobs.filter((row) => row.source === source).length]));
console.log(JSON.stringify({ mode: reportOnly ? "report-only" : apply ? "apply" : "dry-run", candidates: selected.length,
  existingEvidence: rows.size, planned: jobs.length, bySource: plannedBySource, sourceCooldowns }));
if (!apply) process.exit(0);
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
let checkpointChain = Promise.resolve();
const atomicJson = async (path: string, value: unknown) => {
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2) + "\n");
  await rename(`${path}.tmp`, path);
};
const checkpoint = () => {
  const value = { observations: [...rows.values()], attempts: [...attempts.values()], sourceCooldowns };
  checkpointChain = checkpointChain.then(() => atomicJson(checkpointPath, value));
  return checkpointChain;
};
const hosts: Record<ShelfEvidence["source"], string[]> = {
  barbora_lv: ["barbora.lv", "www.barbora.lv"], rimi_lv: ["www.rimi.lv", "rimi.lv"],
  livinn_lt: ["www.livinn.lt", "livinn.lt"], open_food_facts: ["world.openfoodfacts.org"]
};
class SourceRateLimitError extends Error {
  constructor(public readonly notBefore: string, status = 429) { super(`HTTP ${status}`); }
}
async function fetchEvidence(item: Candidate): Promise<ShelfEvidence> {
  let url = item.source === "open_food_facts" ? `https://world.openfoodfacts.org/api/v3/product/${item.sku}` : item.url;
  let body = "";
  for (let redirects = 0; redirects < 4; redirects++) {
    const target = new URL(url);
    if (target.protocol !== "https:" || target.username || target.password || target.port || !hosts[item.source].includes(target.hostname)) throw new Error("Unexpected source host");
    const response = await fetch(url, { redirect: "manual", headers: { "user-agent": "Sugar.no evidence review/1.1 (https://sugar.no)" }, signal: AbortSignal.timeout(15000) });
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.get("location")) {
      url = new URL(response.headers.get("location")!, url).href; continue;
    }
    // Stop this source's queue on rate limiting; never retry earlier than its instruction.
    if (response.status === 429 || response.status === 403 || (item.source === "open_food_facts" && response.status === 503)) throw new SourceRateLimitError(retryNotBefore(response.headers.get("retry-after")), response.status);
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
    evidence = item.offIdentity ? exactOffEvidence(response.product, item.offIdentity, checkedAt) : null;
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
      attempts.set(item.id, { id: item.id, ok: true, attemptedAt: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "source unavailable";
      attempts.set(item.id, { id: item.id, ok: false, error: message, attemptedAt: new Date().toISOString() });
      if (error instanceof SourceRateLimitError) sourceCooldowns[item.source] = error.notBefore;
      console.warn(JSON.stringify({ id: item.id, error: message, retryNotBefore: sourceCooldowns[item.source] || null }));
      if (error instanceof SourceRateLimitError) { await checkpoint(); break; }
    }
    completed++;
    if (completed % 20 === 0) {
      console.log(JSON.stringify({ completed, total: jobs.length, elapsedSeconds: Math.round((Date.now() - started) / 1000) }));
      await checkpoint();
    }
    await sleep(source === "open_food_facts" ? 4100 : 1000);
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
    rateLimited: Boolean(sourceCooldowns[source as ShelfEvidence["source"]]), retryNotBefore: sourceCooldowns[source as ShelfEvidence["source"]] || null }];
}));
const report = { checkedAt: new Date().toISOString(), candidates: selected.length, observations: rows.size, groups, coverage,
  attempts: [...attempts.values()], elapsedSeconds: Math.round((Date.now() - started) / 1000) };
await atomicJson(process.env.SHELF_BATCH_REPORT || ".catalog-sync/personal-shelf-batch-report.json", report);
console.log(JSON.stringify({ ...report, attempts: { successful: report.attempts.filter((a) => a.ok).length, failed: report.attempts.filter((a) => !a.ok).length } }));
