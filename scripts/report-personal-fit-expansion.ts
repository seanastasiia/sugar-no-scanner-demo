import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { assessPersonalShelfProduct, type ShelfAssessment, type ShelfEvidence } from "../src/lib/personal-shelf-rank";

const baselineRef = "b4e74534d08adc3a0b4be7f8fbd485f122c9c29a";
const scratch = await mkdtemp(join(tmpdir(), "sugar-no-expansion-baseline-"));
const prior = (file: string) => execFileSync("git", ["show", `${baselineRef}:${file}`], { encoding: "utf8", maxBuffer: 30 * 1024 * 1024 });
try {
  for (const name of ["personal-shelf-rank", "personal-shelf-ingredient-aliases"]) await writeFile(join(scratch, `${name}.ts`), prior(`src/lib/${name}.ts`));
  const old = await import(pathToFileURL(join(scratch, "personal-shelf-rank.ts")).href) as { assessPersonalShelfProduct: typeof assessPersonalShelfProduct };
  const compare = (a: ShelfAssessment) => JSON.stringify({ ...a, modelVersion: "ignored" });
  const input = (e: ShelfEvidence) => ({ id: e.productId, gtin: e.gtin, category: e.category, format: "other" as const, shelfEvidence: e });
  const report = { baselineRef, beforeAssessable: 0, afterAssessable: 0, addedAssessments: 0, changedPreviouslyAssessable: [] as string[], removedEvidence: [] as string[], changedDemo: [] as string[] };
  for (const file of ["personal-shelf-evidence", "personal-shelf-off-evidence", "shelf-demo-evidence"]) {
    const demo = file === "shelf-demo-evidence";
    const rows = (text: string): ShelfEvidence[] => demo ? (JSON.parse(text) as { evidence: ShelfEvidence }[]).map((r) => r.evidence) : JSON.parse(text);
    const before = rows(prior(`data/${file}.generated.json`));
    const after = rows(await readFile(`data/${file}.generated.json`, "utf8"));
    const byId = new Map(after.map((e) => [e.productId, e]));
    if (byId.size !== after.length) throw new Error("Duplicate evidence IDs");
    for (const e of before) {
      const a = old.assessPersonalShelfProduct(input(e));
      const newE = byId.get(e.productId);
      if (!newE) { report.removedEvidence.push(e.productId); continue; }
      const b = assessPersonalShelfProduct(input(newE));
      const assessed = ["scored", "provisional"].includes(a.status);
      if (!demo && assessed) report.beforeAssessable++;
      if (compare(a) !== compare(b)) {
        if (demo) report.changedDemo.push(e.productId);
        else if (assessed) report.changedPreviouslyAssessable.push(e.productId);
      }
    }
    if (!demo) report.afterAssessable += after.filter((e) => ["scored", "provisional"].includes(assessPersonalShelfProduct(input(e)).status)).length;
  }
  report.addedAssessments = report.afterAssessable - report.beforeAssessable;
  if (process.argv.includes("--write")) await writeFile(".catalog-sync/expansion-2026-09-04/regression.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (report.removedEvidence.length || report.changedPreviouslyAssessable.length || report.changedDemo.length) throw new Error("Expansion regression");
} finally { await rm(scratch, { recursive: true, force: true }); }
