import { execFileSync } from "node:child_process";
import { readFile, rename, writeFile } from "node:fs/promises";
import type { ExternalCatalogProduct } from "../src/server/external-catalog-types";

const baselineRevision = process.env.CATALOG_BASELINE_REVISION || "61be6f5161e1cd111109d7809338c1afc9ae5b4f";
const output = "data/rimi-catalog.generated.json";
const reportOutput = "data/rimi-catalog-sync-report.generated.json";
const baseline = JSON.parse(execFileSync("git", ["show", `${baselineRevision}:${output}`], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024
})) as ExternalCatalogProduct[];
const fresh = JSON.parse(await readFile(output, "utf8")) as ExternalCatalogProduct[];
const report = JSON.parse(await readFile(reportOutput, "utf8")) as Record<string, unknown>;
if (Number(report.historicalProductsRetained || 0) > 0 && Number(report.completeProducts) === fresh.length) {
  console.log(JSON.stringify({ alreadyMerged: true, mergedCompleteProducts: fresh.length,
    historicalProductsRetained: report.historicalProductsRetained }));
  process.exit(0);
}
const baselineIds = new Set(baseline.map((row) => row.sourceProductId));
const freshIds = new Set(fresh.map((row) => row.sourceProductId));
const historical = baseline
  .filter((row) => !freshIds.has(row.sourceProductId))
  .map((row) => ({ ...row, price: null, currency: null, available: false } as ExternalCatalogProduct));
const merged = [...fresh, ...historical].sort((left, right) => left.sourceProductId.localeCompare(right.sourceProductId));

await writeFile(`${output}.tmp`, `${JSON.stringify(merged)}\n`);
await rename(`${output}.tmp`, output);
await writeFile(`${reportOutput}.tmp`, `${JSON.stringify({
  ...report,
  completeProducts: merged.length,
  historicalProductsRetained: historical.length,
  historicalBaselineRevision: baselineRevision
})}\n`);
await rename(`${reportOutput}.tmp`, reportOutput);

console.log(JSON.stringify({
  baselineRevision,
  baselineCompleteProducts: baseline.length,
  freshCompleteProducts: fresh.length,
  newlyDiscoveredCompleteProducts: fresh.filter((row) => !baselineIds.has(row.sourceProductId)).length,
  historicalProductsRetained: historical.length,
  mergedCompleteProducts: merged.length
}));
