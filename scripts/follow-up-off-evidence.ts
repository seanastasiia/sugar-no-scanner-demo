import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { assessPersonalShelfProduct, shelfCategory, type ShelfEvidence } from "../src/lib/personal-shelf-rank";
import { parseShelfEvidence } from "../src/server/personal-shelf-evidence";
import { validWebGtin, webPack } from "../src/server/web-product-evidence";
import type { ExternalCatalogProduct } from "../src/server/external-catalog-types";

// Bounded exact product reads, never a search crawl or a paid lookup.
const dir = ".catalog-sync/expansion-2026-09-04";
const regional = process.argv.includes("--regional");
const cohort = regional ? "off-regional-followup" : "off-followup";
const limit = regional ? 150 : 50;
const file = "data/personal-shelf-off-evidence.generated.json";
const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8"));
const atomic = async (path: string, value: unknown) => {
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2) + "\n");
  await rename(`${path}.tmp`, path);
};
const assess = (e: ShelfEvidence) => assessPersonalShelfProduct({ id: e.productId, gtin: e.gtin, category: e.category, format: "other", shelfEvidence: e });
type Baseline = { ids: string[]; prior: ShelfEvidence[] };
type Checkpoint = { observations: ShelfEvidence[]; attempts: { id: string; ok: boolean; error?: string }[]; sourceCooldowns?: Record<string, string> };
const mode = process.argv[2] || "plan";
await mkdir(dir, { recursive: true });
if (mode === "plan") {
  try { await readFile(`${dir}/${cohort}-baseline.json`); throw new Error("OFF cohort already frozen; use run or report"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const audit = await json<{ records: { id: string; status: string; contradictoryNutrition: boolean }[] }>(".catalog-sync/personal-fit-catalog-audit.json");
  const eligible = new Set(audit.records.filter((r) => r.status === "missing_data" && !r.contradictoryNutrition).map((r) => r.id));
  const products = await json<ExternalCatalogProduct[]>(`data/open-food-facts-${regional ? "regional" : "lv"}.generated.json`);
  const ids = products.filter((p) => eligible.has(`off:${p.sourceProductId}`) && validWebGtin(p.sourceProductId) && webPack(p.packSize) && shelfCategory(p.category))
    .map((p) => `off:${p.sourceProductId}`).sort((a, b) => createHash("sha256").update(a).digest("hex").localeCompare(createHash("sha256").update(b).digest("hex"))).slice(0, limit);
  if (!ids.length) throw new Error("No exact eligible OFF follow-up candidates");
  const prior = await json<ShelfEvidence[]>(file);
  if (prior.some((e) => ids.includes(e.productId) && ["scored", "provisional"].includes(assess(e).status))) throw new Error("Cohort includes a prior assessed product");
  const old = await json<Checkpoint>(".catalog-sync/personal-shelf-batch-v1.json");
  if (regional) {
    const recent = await json<Checkpoint>(`${dir}/off-followup-checkpoint.json`);
    for (const [source, boundary] of Object.entries(recent.sourceCooldowns || {})) {
      if (!old.sourceCooldowns?.[source] || Date.parse(boundary) > Date.parse(old.sourceCooldowns[source])) {
        (old.sourceCooldowns ||= {})[source] = boundary;
      }
    }
  }
  await atomic(`${dir}/${cohort}-baseline.json`, { ids, prior });
  await atomic(`${dir}/${cohort}-ids.json`, ids);
  await atomic(`${dir}/${cohort}-checkpoint.json`, { observations: [], attempts: [], sourceCooldowns: old.sourceCooldowns || {} });
  console.log(JSON.stringify({ selected: ids.length, paidProviderCalls: 0 }));
} else if (mode === "run" || mode === "dry-run") {
  Object.assign(process.env, { SHELF_BATCH_IDS_FILE: `${dir}/${cohort}-ids.json`, SHELF_BATCH_CHECKPOINT: `${dir}/${cohort}-checkpoint.json`,
    SHELF_BATCH_OFF_OUTPUT: `${dir}/${cohort}-off.json`, SHELF_BATCH_RETAILER_OUTPUT: `${dir}/${cohort}-retailer.json`,
    SHELF_BATCH_REPORT: `${dir}/${cohort}-requests.json`, SHELF_BATCH_RESUME_ONLY: "true" });
  process.argv.push("--refresh-existing");
  if (mode === "run") process.argv.push("--apply");
  await import("./sync-personal-shelf-batch");
} else if (mode === "report" || mode === "promote") {
  const { ids, prior } = await json<Baseline>(`${dir}/${cohort}-baseline.json`);
  const saved = await json<Checkpoint>(`${dir}/${cohort}-checkpoint.json`);
  if (saved.attempts.some((a) => !ids.includes(a.id))) throw new Error("Out-of-scope OFF request");
  const before = new Map(prior.map((e) => [e.productId, e]));
  const current = await json<ShelfEvidence[]>(file);
  const result = new Map(current.map((e) => [e.productId, e]));
  const successful = new Set(saved.attempts.filter((a) => a.ok).map((a) => a.id));
  let accepted = 0, newlyAssessable = 0;
  for (const id of successful) {
    const evidence = parseShelfEvidence(saved.observations.find((e) => e.productId === id));
    if (!evidence || evidence.source !== "open_food_facts") throw new Error(`Invalid exact observation: ${id}`);
    // A concurrent import may append OTHER products, but may not change this target.
    const existing = result.get(id);
    if (JSON.stringify(existing) !== JSON.stringify(before.get(id)) && JSON.stringify(existing) !== JSON.stringify(evidence)) throw new Error(`Concurrent target change: ${id}`);
    if (before.has(id) && Date.parse(evidence.checkedAt) <= Date.parse(before.get(id)!.checkedAt)) throw new Error(`Stale observation: ${id}`);
    result.set(id, evidence); accepted++;
    if (["scored", "provisional"].includes(assess(evidence).status)) newlyAssessable++;
  }
  const report = { checkedAt: new Date().toISOString(), selected: ids.length, attempted: saved.attempts.length, accepted, newlyAssessable,
    sourceCooldowns: saved.sourceCooldowns, paidProviderCalls: 0, failures: saved.attempts.filter((a) => !a.ok) };
  await atomic(`${dir}/${cohort}-impact.json`, report);
  if (mode === "promote") await atomic(file, [...result.values()].sort((a, b) => a.productId.localeCompare(b.productId)));
  console.log(JSON.stringify(report, null, 2));
} else throw new Error("Use plan, dry-run, run, report or promote");
