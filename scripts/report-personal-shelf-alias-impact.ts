import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { assessPersonalShelfProduct, analyzeIngredients, SHELF_MODEL_VERSION, type ShelfAssessment, type ShelfEvidence } from "../src/lib/personal-shelf-rank";

// Pinned reproducible v1.3 baseline; no database, web, provider, or catalog writes.
const baselineRef = "47e9664686fde04945201b13e7e4b4414e7fe75d";
const scratch = await mkdtemp(join(tmpdir(), "sugar-no-alias-baseline-"));
try {
  const modulePath = join(scratch, "baseline.ts");
  await writeFile(modulePath, execFileSync("git", ["show", `${baselineRef}:src/lib/personal-shelf-rank.ts`], { encoding: "utf8" }));
  const baseline = await import(pathToFileURL(modulePath).href) as { assessPersonalShelfProduct: typeof assessPersonalShelfProduct };
  const files = ["data/personal-shelf-evidence.generated.json", "data/personal-shelf-off-evidence.generated.json", "data/shelf-demo-evidence.generated.json"];
  const inputs: Record<string, string> = {};
  const rows: Array<{ evidence: ShelfEvidence; demo: boolean }> = [];
  for (const file of files) {
    const bytes = await readFile(file, "utf8");
    inputs[file] = createHash("sha256").update(bytes).digest("hex");
    const originalBytes = execFileSync("git", ["show", `${baselineRef}:${file}`], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
    if (bytes !== originalBytes) throw new Error(`Evidence changed since the pinned baseline: ${file}`);
    rows.push(...(JSON.parse(bytes) as ShelfEvidence[]).map(evidence => ({ evidence, demo: file.includes("shelf-demo") })));
  }
  const counts = { observations: 0, cohort: 0, unlockedCohort: 0, blockedCohort: 0, additionalUnlocked: 0,
    beforeScored: 0, beforeProvisional: 0, afterScored: 0, afterProvisional: 0, changedPreviouslyAssessable: 0, changedDemo: 0 };
  const byRule: Record<string, number> = {};
  const comparable = (assessment: ShelfAssessment) => JSON.stringify({ ...assessment, modelVersion: "ignored" });
  const records = rows.map(({ evidence, demo }) => {
    const product = { id: evidence.productId, gtin: evidence.gtin, category: evidence.category, format: "other" as const, shelfEvidence: evidence };
    const before = baseline.assessPersonalShelfProduct(product);
    const after = assessPersonalShelfProduct(product);
    const cohort = !demo && before.missing.length === 1 && before.missing[0] === "recognized first ingredient";
    const wasAssessed = ["scored", "provisional"].includes(before.status);
    const isAssessed = ["scored", "provisional"].includes(after.status);
    const changed = comparable(before) !== comparable(after);
    const ingredient = analyzeIngredients(evidence.ingredientsText, evidence.ingredientsLanguage, after.category || undefined);
    if (demo) { if (changed) counts.changedDemo++; }
    else {
      counts.observations++;
      if (cohort) { counts.cohort++; if (isAssessed) counts.unlockedCohort++; else counts.blockedCohort++; }
      if (!cohort && !wasAssessed && isAssessed) counts.additionalUnlocked++;
      if (wasAssessed && changed) counts.changedPreviouslyAssessable++;
      if (before.status === "scored") counts.beforeScored++;
      if (before.status === "provisional") counts.beforeProvisional++;
      if (after.status === "scored") counts.afterScored++;
      if (after.status === "provisional") counts.afterProvisional++;
      if (!wasAssessed && isAssessed) byRule[ingredient?.aliasRule || "unknown"] = (byRule[ingredient?.aliasRule || "unknown"] || 0) + 1;
    }
    return { id: evidence.productId, demo, cohort, category: after.category, firstIngredient: ingredient?.firstIngredient,
      rule: ingredient?.aliasRule, before, after };
  });
  const summary = { baselineRef, model: SHELF_MODEL_VERSION, ...counts, byRule };
  if (process.argv.includes("--write")) {
    await mkdir(".catalog-sync", { recursive: true });
    await writeFile(".catalog-sync/personal-fit-alias-impact.json", JSON.stringify({ ...summary, inputs, records }, null, 2) + "\n");
  }
  console.log(JSON.stringify(summary, null, 2));
  if (counts.changedPreviouslyAssessable || counts.changedDemo) throw new Error("Fallback-only change altered a previously assessed or demo record");
} finally {
  await rm(scratch, { recursive: true, force: true });
}
