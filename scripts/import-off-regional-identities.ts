import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import completeLatvia from "../data/open-food-facts-lv.generated.json";
import completeRegional from "../data/open-food-facts-regional.generated.json";
import { offParquetIdentity, type OffParquetRow } from "../src/server/open-food-facts-parquet";
import type { ExternalCatalogIdentity, ExternalCatalogProduct } from "../src/server/external-catalog-types";
import { validWebGtin } from "../src/server/web-product-evidence";

const directory = ".catalog-sync/expansion-2026-09-04";
const inputPath = `${directory}/off-parquet-rows.jsonl`;
const candidatePath = `${directory}/off-regional-identities-candidate.json`;
const localReportPath = `${directory}/off-regional-identities-report.json`;
const outputPath = "data/open-food-facts-regional-identities.generated.json";
const reportPath = "data/open-food-facts-regional-identities-report.generated.json";
const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8"));

const extraction = await json<{ format?: string; revision: string; rows: number; sourceUrl: string; checkedAt: string }>(
  `${directory}/off-extraction.json`
);
const pinnedSource = extraction.format === "csv"
  ? extraction.sourceUrl === `https://openfoodfacts-ds.s3.eu-west-3.amazonaws.com/en.openfoodfacts.org.products.csv.gz?versionId=${extraction.revision}` && /^[A-Za-z0-9_.-]+$/.test(extraction.revision)
  : /^[a-f0-9]{40}$/.test(extraction.revision) && extraction.sourceUrl === `https://huggingface.co/datasets/openfoodfacts/product-database/resolve/${extraction.revision}/food.parquet`;
if (!pinnedSource || extraction.rows < 1 || extraction.rows > 100_000) throw new Error("Unbounded or unpinned extraction");
if (!Number.isFinite(Date.parse(extraction.checkedAt))) throw new Error("Missing extraction date");
const checkedAt = new Date(extraction.checkedAt).toISOString();
const completeGtins = new Set(
  [...completeLatvia, ...completeRegional]
    .map((row) => validWebGtin((row as ExternalCatalogProduct).gtin || (row as ExternalCatalogProduct).sourceProductId))
    .filter((value): value is string => Boolean(value))
);
const identities = new Map<string, ExternalCatalogIdentity>();
const conflicts = new Set<string>();
const rejected: Record<string, number> = {};
let rows = 0;
let completeRows = 0;
const reject = (reason: string) => { rejected[reason] = (rejected[reason] || 0) + 1; };

for await (const line of createInterface({ input: createReadStream(inputPath), crlfDelay: Infinity })) {
  if (!line.trim()) continue;
  rows += 1;
  if (rows > 100_000) throw new Error("Regional row bound exceeded");
  const source = JSON.parse(line) as OffParquetRow;
  const gtin = validWebGtin(source.code);
  if (gtin && completeGtins.has(gtin)) {
    completeRows += 1;
    continue;
  }
  const { identity, reason } = offParquetIdentity(source, checkedAt);
  if (!identity || !gtin) {
    reject(reason || "invalid_identity");
    continue;
  }
  if (conflicts.has(gtin)) {
    reject("ambiguous_duplicate_gtin");
    continue;
  }
  const current = identities.get(gtin);
  if (current && JSON.stringify(current) !== JSON.stringify(identity)) {
    identities.delete(gtin);
    conflicts.add(gtin);
    reject("ambiguous_duplicate_gtin");
    continue;
  }
  identities.set(gtin, identity);
}
if (rows !== extraction.rows) throw new Error(`Incomplete extraction input: expected ${extraction.rows}, got ${rows}`);
const added = [...identities.values()].sort((left, right) => left.sourceProductId.localeCompare(right.sourceProductId));
const report = {
  ...extraction,
  checkedAt,
  rows,
  completeRows,
  identityOnlyRows: added.length,
  rejected,
  conflicts: [...conflicts].sort(),
  aliasCount: added.reduce((sum, row) => sum + row.aliases.length, 0),
  withPackSize: added.filter((row) => row.packSize).length,
  withCategory: added.filter((row) => row.category).length,
  license: "ODbL-1.0",
  nutritionImported: false,
  ingredientsImported: false,
  imagesImported: false,
  candidateSha256: createHash("sha256").update(JSON.stringify(added)).digest("hex")
};
await writeFile(candidatePath, `${JSON.stringify(added, null, 2)}\n`);
await writeFile(localReportPath, `${JSON.stringify(report, null, 2)}\n`);
if (process.argv.includes("--apply")) {
  await writeFile(outputPath, `${JSON.stringify(added, null, 2)}\n`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
