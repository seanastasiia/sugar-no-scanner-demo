import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { assessPersonalShelfProduct, shelfCategory, type ShelfEvidence } from "../src/lib/personal-shelf-rank";
import { exactPackageBasisConversion } from "../src/lib/personal-shelf-basis-conversion";
import type { ExternalCatalogProduct } from "../src/server/external-catalog-types";

const evidenceFile = "data/personal-shelf-evidence.generated.json";
const reportFile = ".catalog-sync/personal-fit-basis-conversion-report.json";
const json = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, "utf8"));
const atomic = async (file: string, value: unknown) => {
  await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2) + "\n");
  await rename(`${file}.tmp`, file);
};
const rows = await json<ShelfEvidence[]>(evidenceFile);
const rimi = await json<ExternalCatalogProduct[]>("data/rimi-catalog.generated.json");
const titles = new Map(rimi.map((row) => [`rimi_lv:${row.sourceProductId}`, row.title]));
const before = new Map(rows.map((row) => [row.productId, assessPersonalShelfProduct({ id: row.productId, gtin: row.gtin, category: row.category, format: "other", shelfEvidence: row }).status]));
const convertedIds: string[] = [];
const output = rows.map((row): ShelfEvidence => {
  if (row.source !== "rimi_lv" || row.nutritionBasis !== "100ml" || shelfCategory(row.category) !== "ice-cream") return row;
  const sourceTitle = titles.get(row.productId);
  const basisConversion = sourceTitle ? exactPackageBasisConversion(sourceTitle) : null;
  if (!basisConversion) return row;
  convertedIds.push(row.productId);
  return { ...row, basisConversion };
});
if (convertedIds.length !== 178 || new Set(convertedIds).size !== 178) throw new Error(`Expected exactly 178 exact conversions, found ${convertedIds.length}`);
const transitions: Record<string, number> = {};
for (const row of output.filter((item) => convertedIds.includes(item.productId))) {
  const after = assessPersonalShelfProduct({ id: row.productId, gtin: row.gtin, category: row.category, format: "other", shelfEvidence: row }).status;
  const key = `${before.get(row.productId)}->${after}`;
  transitions[key] = (transitions[key] || 0) + 1;
}
const report = {
  checkedAt: new Date().toISOString(), conversionCount: convertedIds.length, source: "rimi_lv", category: "ice-cream",
  method: "exact_package_mass_volume", transitions, ids: convertedIds.sort(),
  inputHash: createHash("sha256").update(await readFile(evidenceFile)).digest("hex")
};
if (process.argv.includes("--write")) {
  await atomic(evidenceFile, output);
  await mkdir(".catalog-sync", { recursive: true });
  await atomic(reportFile, report);
}
console.log(JSON.stringify({ ...report, ids: undefined, output: process.argv.includes("--write") ? reportFile : null }));
