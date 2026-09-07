import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseCspPriceCsv } from "../src/server/csp-catalog";

const input = process.env.CSP_CSV_INPUT?.trim();
if (!input) {
  console.log(JSON.stringify({ connected: false, reason: "CSP_CSV_INPUT is not configured; no provider file has been issued", records: 0, identities: 0 }, null, 2));
  if (process.argv.includes("--apply")) throw new Error("Cannot apply CSP import without an issued CSP_CSV_INPUT file");
  process.exit(0);
}
const inputPath = resolve(input);
const metadata = await stat(inputPath);
if (!metadata.isFile() || metadata.size < 1 || metadata.size > 100_000_000) throw new Error("CSP input must be a 1..100 MB file");
const source = await readFile(inputPath);
const importedAt = new Date().toISOString();
const parsed = parseCspPriceCsv(source.toString("utf8"));
const report = {
  connected: true,
  importedAt,
  sourceSha256: createHash("sha256").update(source).digest("hex"),
  records: parsed.records.length,
  identities: parsed.identities.length,
  rejected: parsed.rejected,
  identityConflicts: parsed.identityConflicts,
  delimiter: parsed.delimiter,
  nutritionImported: false,
  ingredientsImported: false,
  imagesImported: false,
  permittedPurpose: "free_food_price_comparison"
};
if (process.argv.includes("--apply")) {
  await writeFile("data/csp-price-records.generated.json", `${JSON.stringify(parsed.records, null, 2)}\n`);
  await writeFile("data/csp-food-identities.generated.json", `${JSON.stringify(parsed.identities, null, 2)}\n`);
  await writeFile("data/csp-import-report.generated.json", `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
