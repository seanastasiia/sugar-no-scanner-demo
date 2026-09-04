import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { offParquetProduct, type OffParquetRow } from "../src/server/open-food-facts-parquet";
import { validWebGtin } from "../src/server/web-product-evidence";
import { parseShelfEvidence } from "../src/server/personal-shelf-evidence";
import { assessPersonalShelfProduct, hasContradictoryShelfNutrition, type ShelfEvidence } from "../src/lib/personal-shelf-rank";
import type { ExternalCatalogProduct } from "../src/server/external-catalog-types";

// Local, isolated ODbL candidate first; --apply appends accepted new GTINs only.
const dir = ".catalog-sync/expansion-2026-09-04";
const json = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, "utf8"));
const extraction = await json<{ format?: string; revision: string; rows: number; sourceUrl: string; checkedAt: string }>(`${dir}/off-extraction.json`);
const pinnedSource = extraction.format === "csv"
  ? extraction.sourceUrl === `https://openfoodfacts-ds.s3.eu-west-3.amazonaws.com/en.openfoodfacts.org.products.csv.gz?versionId=${extraction.revision}` && /^[A-Za-z0-9_.-]+$/.test(extraction.revision)
  : /^[a-f0-9]{40}$/.test(extraction.revision) && extraction.sourceUrl === `https://huggingface.co/datasets/openfoodfacts/product-database/resolve/${extraction.revision}/food.parquet`;
if (!pinnedSource || extraction.rows > 100_000 || extraction.rows < 1) throw new Error("Unbounded or unpinned extraction");
if (!Number.isFinite(Date.parse(extraction.checkedAt))) throw new Error("Missing extraction date");
const checkedAt = new Date(extraction.checkedAt).toISOString();
const existing = [...await json<ExternalCatalogProduct[]>("data/open-food-facts-lv.generated.json"), ...await json<ExternalCatalogProduct[]>("data/open-food-facts-regional.generated.json")];
const existingGtins = new Set(existing.map((r) => validWebGtin(r.gtin || r.sourceProductId)).filter(Boolean));
const candidates = new Map<string, ExternalCatalogProduct>();
const conflicts = new Set<string>();
const rejected: Record<string, number> = {};
let rows = 0, existingRows = 0;
const skip = (reason: string) => { rejected[reason] = (rejected[reason] || 0) + 1; };
for await (const line of createInterface({ input: createReadStream(`${dir}/off-parquet-rows.jsonl`), crlfDelay: Infinity })) {
  if (!line.trim()) continue;
  if (++rows > 100_000) throw new Error("Regional row bound exceeded");
  const row = JSON.parse(line) as OffParquetRow;
  const key = validWebGtin(row.code);
  if (key && existingGtins.has(key)) { existingRows++; continue; }
  const { product, reason } = offParquetProduct(row, checkedAt);
  if (!product || !key) { skip(reason || "invalid_gtin"); continue; }
  const evidence = parseShelfEvidence(product.shelfEvidence);
  if (!evidence || hasContradictoryShelfNutrition(evidence) || product.energyKcal > 1000 || product.proteinG > 100 || product.totalSugarG > 100) { skip("invalid_or_inconsistent_source_table"); continue; }
  if (conflicts.has(key)) { skip("ambiguous_duplicate_gtin"); continue; }
  if (candidates.has(key) && JSON.stringify(candidates.get(key)) !== JSON.stringify(product)) {
    candidates.delete(key); conflicts.add(key); skip("ambiguous_duplicate_gtin"); continue;
  }
  candidates.set(key, product);
}
if (rows !== extraction.rows) throw new Error("Incomplete extraction input");
const added = [...candidates.values()].sort((a, b) => a.sourceProductId.localeCompare(b.sourceProductId));
const statuses: Record<string, number> = {};
for (const product of added) {
  const a = assessPersonalShelfProduct({ id: `off:${product.sourceProductId}`, gtin: product.gtin, category: product.category, format: "other", shelfEvidence: product.shelfEvidence });
  statuses[a.status] = (statuses[a.status] || 0) + 1;
}
const report = { ...extraction, checkedAt, rows, existingRows, added: added.length, rejected, conflicts: [...conflicts], statuses,
  aliasCount: added.reduce((n, p) => n + (p.aliases?.length || 0), 0), license: "ODbL-1.0", imagesImported: false,
  candidateSha256: createHash("sha256").update(JSON.stringify(added)).digest("hex") };
await writeFile(`${dir}/off-regional-candidate.json`, JSON.stringify(added, null, 2) + "\n");
await writeFile(`${dir}/off-import-report.json`, JSON.stringify(report, null, 2) + "\n");
if (process.argv.includes("--apply") && added.length) {
  const regional = await json<ExternalCatalogProduct[]>("data/open-food-facts-regional.generated.json");
  const observations = await json<ShelfEvidence[]>("data/personal-shelf-off-evidence.generated.json");
  const priorIds = new Set(observations.map((e) => e.productId));
  if (added.some((p) => priorIds.has(p.shelfEvidence!.productId))) throw new Error("New product would overwrite prior OFF evidence");
  await writeFile("data/open-food-facts-regional.generated.json", JSON.stringify([...regional, ...added], null, 2) + "\n");
  await writeFile("data/personal-shelf-off-evidence.generated.json", JSON.stringify([...observations, ...added.map((p) => p.shelfEvidence!)], null, 2) + "\n");
  await writeFile("data/open-food-facts-regional-import-report.generated.json", JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
