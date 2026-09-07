import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { auditShelfInventory, type ShelfAuditIdentity } from "../src/server/personal-shelf-audit";
import { rimiShelfCategory } from "../src/server/personal-shelf-parser";
import type { ShelfEvidence } from "../src/lib/personal-shelf-rank";
import type { ExternalCatalogIdentity, ExternalCatalogProduct } from "../src/server/external-catalog-types";
import type { BarboraNutritionIndexProduct } from "../src/server/barbora-nutrition-index";

// No network, provider, application catalog writes, or database access. --write only saves an audit.
const inputs: Record<string, string> = {};
async function json<T>(name: string): Promise<T[]> {
  const body = await readFile(`data/${name}.generated.json`, "utf8");
  inputs[name] = createHash("sha256").update(body).digest("hex");
  return JSON.parse(body);
}
const barboraSlugs = await json<string>("barbora-food-product-index");
const barboraSlugSet = new Set(barboraSlugs);
const barboraNutrition = await json<BarboraNutritionIndexProduct>("barbora-nutrition-index");
const nutrition = new Map(barboraNutrition.map((row) => [row.slug, row]));
const inventory: ShelfAuditIdentity[] = barboraSlugs.map((slug) => {
  const row = nutrition.get(slug);
  return { id: `barbora:${slug}`, source: "barbora_lv", title: row?.title || slug.replaceAll("-", " "), category: row?.category || null, brand: row?.brand || null,
    packSize: row?.packSize || null, gtin: null, excluded: row?.isAdult || false };
});
for (const name of ["rimi-catalog", "livinn-food-index", "livin-catalog", "open-food-facts-lv", "open-food-facts-regional"]) {
  const rows = await json<ExternalCatalogProduct | ExternalCatalogIdentity>(name);
  for (const row of rows) inventory.push({
    id: `${row.source === "open_food_facts" ? "off" : row.source}:${row.sourceProductId}`,
    source: row.source, title: row.title, aliases: row.aliases, category: row.source === "rimi_lv" ? rimiShelfCategory(row.url) : row.category,
    brand: row.brand, packSize: row.packSize, gtin: row.gtin
  });
}
const evidence = [...await json<ShelfEvidence>("personal-shelf-evidence"), ...await json<ShelfEvidence>("personal-shelf-off-evidence")];
const referenceCount = (await json<unknown>("catalog")).length;
const report = { checkedAt: new Date().toISOString(), commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  inputHashes: inputs, ...auditShelfInventory(inventory, evidence), referenceRowsOutsideInventory: referenceCount,
  barboraNutritionOutsideInventory: barboraNutrition.filter((row) => !barboraSlugSet.has(row.slug)).map((row) => row.slug) };
if (process.argv.includes("--write")) {
  await mkdir(".catalog-sync", { recursive: true });
  const file = ".catalog-sync/personal-fit-catalog-audit.json";
  await writeFile(`${file}.tmp`, JSON.stringify(report, null, 2) + "\n");
  await rename(`${file}.tmp`, file);
}
console.log(JSON.stringify({ ...report.summary, referenceRowsOutsideInventory: report.referenceRowsOutsideInventory,
  evidenceOutsideInventory: report.evidenceOutsideInventory.length, duplicateSourceIds: report.duplicateSourceIds.length,
  duplicateEvidenceIds: report.duplicateEvidenceIds.length, output: process.argv.includes("--write") ? ".catalog-sync/personal-fit-catalog-audit.json" : null }));
