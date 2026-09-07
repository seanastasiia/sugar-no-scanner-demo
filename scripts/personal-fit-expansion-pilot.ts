import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { assessPersonalShelfProduct, type ShelfEvidence } from "../src/lib/personal-shelf-rank";
import { parseShelfEvidence } from "../src/server/personal-shelf-evidence";

// An explicit frozen cohort, not an unbounded search or a production database job.
const dir = ".catalog-sync/expansion-2026-09-04";
const json = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, "utf8"));
const atomic = async (file: string, value: unknown) => {
  await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2) + "\n");
  await rename(`${file}.tmp`, file);
};
type AuditRow = { id: string; source: string; category: string | null; status: string; hasEvidence: boolean; missing: string[]; contradictoryNutrition: boolean };
type Baseline = { commit: string; checkedAt: string; inputHashes: Record<string, string>; selected: AuditRow[]; observations: ShelfEvidence[] };
const assess = (e: ShelfEvidence) => assessPersonalShelfProduct({ id: e.productId, category: e.category, gtin: e.gtin, format: "other", shelfEvidence: e });
const mode = process.argv[2] || "plan";
await mkdir(dir, { recursive: true });
if (mode === "plan") {
  try { await readFile(`${dir}/baseline.json`); throw new Error("Frozen pilot already exists; use run or report"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const audit = await json<{ records: AuditRow[]; inputHashes: Record<string, string> }>(".catalog-sync/personal-fit-catalog-audit.json");
  const observations = [...await json<ShelfEvidence[]>("data/personal-shelf-evidence.generated.json"), ...await json<ShelfEvidence[]>("data/personal-shelf-off-evidence.generated.json")];
  const selected: AuditRow[] = [];
  const categoryOrder = ["chips", "bar", "yogurt", "breakfast-cereal", "cookie", "chocolate", "crackers", "cheese", "bread", "pasta", "nuts-seeds", "dried-fruit", "savory-snack", "dairy-dessert", "candy", "ice-cream", "sauce", "meat-product", "fish-product"];
  for (const [source, quota] of [["barbora_lv", 100], ["rimi_lv", 60], ["livinn_lt", 40]] as const) {
    const candidates = audit.records.filter((r) => r.source === source && r.status === "missing_data" && !r.contradictoryNutrition &&
      (!r.hasEvidence || r.missing.some((x) => !["recognized first ingredient", "ingredient list in a supported language"].includes(x))));
    const groups = new Map<string, AuditRow[]>();
    for (const row of candidates) {
      const key = row.category || "unknown";
      groups.set(key, [...(groups.get(key) || []), row]);
    }
    for (const group of groups.values()) group.sort((a, b) => Number(a.hasEvidence) - Number(b.hasEvidence) ||
      createHash("sha256").update(a.id).digest("hex").localeCompare(createHash("sha256").update(b.id).digest("hex")));
    const categories = [...new Set([...categoryOrder, ...groups.keys()])];
    let count = 0;
    while (count < quota) {
      let added = 0;
      for (const category of categories) {
        const row = groups.get(category)?.shift();
        if (row) { selected.push(row); count++; added++; }
        if (count === quota) break;
      }
      if (!added) throw new Error(`Not enough eligible ${source} candidates`);
    }
  }
  if (selected.length !== 200) throw new Error("Expected exactly 200 IDs");
  const baseline: Baseline = { commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), checkedAt: new Date().toISOString(), inputHashes: audit.inputHashes, selected, observations };
  await atomic(`${dir}/baseline.json`, baseline);
  await atomic(`${dir}/ids.json`, selected.map((r) => r.id));
  // Inherit every source cooldown. A separate checkpoint must not reset a refusal.
  const old = await json<{ sourceCooldowns?: Record<string, string> }>(".catalog-sync/personal-shelf-batch-v1.json");
  await atomic(`${dir}/checkpoint.json`, { observations: [], attempts: [], sourceCooldowns: old.sourceCooldowns || {} });
  console.log(JSON.stringify({ mode, total: selected.length, bySource: Object.fromEntries(["barbora_lv", "rimi_lv", "livinn_lt"].map((s) => [s, selected.filter((r) => r.source === s).length])), file: `${dir}/baseline.json` }));
} else if (mode === "run" || mode === "dry-run" || mode === "retry-rimi-parser") {
  await json<Baseline>(`${dir}/baseline.json`);
  const parserRetry = mode === "retry-rimi-parser";
  if (parserRetry) {
    const first = await json<{ attempts: Array<{ id: string; ok: boolean; error?: string }>; sourceCooldowns?: Record<string, string> }>(`${dir}/checkpoint.json`);
    const ids = first.attempts.filter((a) => !a.ok && a.id.startsWith("rimi_lv:") && a.error === "Missing exact labelled evidence").map((a) => a.id);
    if (!ids.length) throw new Error("No Rimi parser failures to review");
    await atomic(`${dir}/rimi-retry-ids.json`, ids);
    try { await readFile(`${dir}/rimi-retry-checkpoint.json`); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await atomic(`${dir}/rimi-retry-checkpoint.json`, { observations: [], attempts: [], sourceCooldowns: first.sourceCooldowns || {} });
    }
  }
  Object.assign(process.env, {
    SHELF_BATCH_IDS_FILE: `${dir}/${parserRetry ? "rimi-retry-ids" : "ids"}.json`, SHELF_BATCH_CHECKPOINT: `${dir}/${parserRetry ? "rimi-retry-checkpoint" : "checkpoint"}.json`,
    SHELF_BATCH_RESUME_ONLY: "true",
    SHELF_BATCH_RETAILER_OUTPUT: `${dir}/${parserRetry ? "rimi-retry-" : ""}retailer.json`, SHELF_BATCH_OFF_OUTPUT: `${dir}/${parserRetry ? "rimi-retry-" : ""}off.json`, SHELF_BATCH_REPORT: `${dir}/${parserRetry ? "rimi-retry-" : ""}requests.json`
  });
  process.argv.push("--refresh-existing");
  if (mode !== "dry-run") process.argv.push("--apply");
  await import("./sync-personal-shelf-batch");
} else if (mode === "report" || mode === "promote") {
  const baseline = await json<Baseline>(`${dir}/baseline.json`);
  const checkpoint = await json<{ observations: ShelfEvidence[]; attempts: Array<{ id: string; ok: boolean; error?: string }> ; sourceCooldowns: Record<string, string> }>(`${dir}/checkpoint.json`);
  const selected = new Set(baseline.selected.map((r) => r.id));
  const original = new Map(baseline.observations.map((e) => [e.productId, e]));
  const rows = new Map(original);
  const attempts = new Map(checkpoint.attempts.map((r) => [r.id, r]));
  let additionalAttempts = 0;
  try {
    const retry = await json<typeof checkpoint>(`${dir}/rimi-retry-checkpoint.json`);
    additionalAttempts = retry.attempts.length;
    for (const attempt of retry.attempts) {
      if (!selected.has(attempt.id) || !attempt.id.startsWith("rimi_lv:")) throw new Error("Out-of-scope retry");
      attempts.set(attempt.id, attempt);
    }
    for (const row of retry.observations.filter((e) => selected.has(e.productId))) {
      if (!retry.attempts.some((a) => a.id === row.productId && a.ok)) continue;
      const index = checkpoint.observations.findIndex((e) => e.productId === row.productId);
      if (index < 0) checkpoint.observations.push(row); else checkpoint.observations[index] = row;
    }
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const outcomes = baseline.selected.map((r) => {
    const attempt = attempts.get(r.id);
    const candidate = checkpoint.observations.find((e) => e.productId === r.id);
    const before = original.get(r.id);
    if (attempt?.ok && candidate) {
      const parsed = parseShelfEvidence(candidate);
      if (!parsed || parsed.source !== r.source || (before && Date.parse(parsed.checkedAt) <= Date.parse(before.checkedAt))) throw new Error(`Unsafe candidate ${r.id}`);
      rows.set(r.id, parsed);
    }
    const after = rows.get(r.id);
    const assessment = after ? assess(after) : null;
    return { id: r.id, source: r.source, attempted: Boolean(attempt), accepted: attempt?.ok === true,
      error: attempt?.error || (!attempt ? "source paused before this candidate" : null),
      beforeStatus: r.status, afterStatus: assessment?.status || r.status,
      newlyAssessable: ["scored", "provisional"].includes(assessment?.status || ""),
      missing: assessment?.missing || r.missing, sourceUrl: after?.sourceUrl || null };
  });
  for (const [id, before] of original) if (!selected.has(id) && JSON.stringify(rows.get(id)) !== JSON.stringify(before)) throw new Error(`Changed out-of-scope evidence ${id}`);
  const result = [...rows.values()].sort((a, b) => a.productId.localeCompare(b.productId));
  const report = { checkedAt: new Date().toISOString(), baselineCommit: baseline.commit, selected: outcomes.length,
    attempted: outcomes.filter((r) => r.attempted).length, accepted: outcomes.filter((r) => r.accepted).length,
    newlyAssessable: outcomes.filter((r) => r.newlyAssessable).length, observationsBefore: original.size, observationsAfter: result.length,
    sourceCooldowns: checkpoint.sourceCooldowns, additionalAttempts, providerRequests: 0, paidProviderCost: 0, outcomes };
  await atomic(`${dir}/impact.json`, report);
  if (mode === "promote") {
    for (const name of ["personal-shelf-evidence", "personal-shelf-off-evidence"]) {
      const body = await readFile(`data/${name}.generated.json`, "utf8");
      if (createHash("sha256").update(body).digest("hex") !== baseline.inputHashes[name]) throw new Error(`Baseline changed: ${name}`);
    }
    await atomic("data/personal-shelf-evidence.generated.json", result.filter((e) => e.source !== "open_food_facts"));
    // No OFF job in this cohort, so preserve its file byte-for-byte.
  }
  console.log(JSON.stringify({ ...report, outcomes: undefined }));
} else throw new Error("Use plan, dry-run, run, report or promote");
