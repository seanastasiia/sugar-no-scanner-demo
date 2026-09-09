import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ShelfEvidence } from "../src/lib/personal-shelf-rank";
import type { BarboraNutritionIndexProduct } from "../src/server/barbora-nutrition-index";
import type { ExternalCatalogIdentity, ExternalCatalogProduct } from "../src/server/external-catalog-types";
import { auditShelfInventory, type ShelfAuditIdentity } from "../src/server/personal-shelf-audit";
import { rimiShelfCategory } from "../src/server/personal-shelf-parser";
import { validWebGtin } from "../src/server/web-product-evidence";

const baselineRevision = process.env.CATALOG_BASELINE_REVISION || "61be6f5161e1cd111109d7809338c1afc9ae5b4f";
const output = process.env.RIMI_LIDL_EXPANSION_REPORT || "data/rimi-lidl-expansion-report.generated.json";
const expandedCategories = ["vegana-un-vegetara-partika", "gatavots-rimi"];

type ShelfAudit = {
  checkedAt: string;
  summary: {
    totals: Record<string, number>;
    assessable: number;
    evidenceObservations: number;
    inventoryWithEvidence: number;
  };
  records: Array<{
    id: string;
    source: string;
    sourceCategory: string | null;
    status: string;
    hasEvidence: boolean;
  }>;
};

type LidlReport = {
  checkedAt: string;
  discoveredUrls: number;
  processedUrls: number;
  completeProducts: number;
  foodProducts: number;
  identityOnlyProducts: number;
  nonFoodOrUnclassifiedPages: number;
  failedUrls: number;
};

const json = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, "utf8")) as T;
const gitJson = <T>(file: string): T => JSON.parse(execFileSync("git", ["show", `${baselineRevision}:${file}`], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024
})) as T;
const topCategory = (url: string) => new URL(url).pathname.split("/produkti/")[1]?.split("/")[0] || "unknown";
const sha256 = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sourceIds = (rows: Array<{ sourceProductId: string }>) => new Set(rows.map((row) => row.sourceProductId));
const difference = (left: Set<string>, right: Set<string>) => [...left].filter((id) => !right.has(id)).sort();
const auditSlice = (audit: ShelfAudit | null) => audit && ({
  checkedAt: audit.checkedAt,
  assessable: audit.summary.assessable,
  evidenceObservations: audit.summary.evidenceObservations,
  inventoryWithEvidence: audit.summary.inventoryWithEvidence,
  totals: audit.summary.totals,
  expandedCategories: Object.fromEntries(expandedCategories.map((category) => {
    const rows = audit.records.filter((row) => row.source === "rimi_lv" && row.sourceCategory?.split(" > ")[0] === category);
    return [category, {
      records: rows.length,
      assessable: rows.filter((row) => row.status === "scored" || row.status === "provisional").length,
      withEvidence: rows.filter((row) => row.hasEvidence).length,
      status: Object.fromEntries([...new Set(rows.map((row) => row.status))].map((status) => [status, rows.filter((row) => row.status === status).length]))
    }];
  }))
});

const previousRimi = gitJson<ExternalCatalogProduct[]>("data/rimi-catalog.generated.json");
const currentRimi = await json<ExternalCatalogProduct[]>("data/rimi-catalog.generated.json");
const rimiIdentities = await json<ExternalCatalogIdentity[]>("data/rimi-food-index.generated.json");
const lidlIdentities = await json<ExternalCatalogIdentity[]>("data/lidl-food-index.generated.json");
const lidlReport = await json<LidlReport>("data/lidl-catalog-sync-report.generated.json");
const offComplete = [
  ...await json<ExternalCatalogProduct[]>("data/open-food-facts-lv.generated.json"),
  ...await json<ExternalCatalogProduct[]>("data/open-food-facts-regional.generated.json")
];
const completeOffGtins = new Set(offComplete.flatMap((row) => validWebGtin(row.gtin) ? [row.gtin!] : []));
const barboraSlugs = await json<string[]>("data/barbora-food-product-index.generated.json");
const barboraNutrition = await json<BarboraNutritionIndexProduct[]>("data/barbora-nutrition-index.generated.json");
const barboraBySlug = new Map(barboraNutrition.map((row) => [row.slug, row]));
const livinnIdentities = await json<ExternalCatalogIdentity[]>("data/livinn-food-index.generated.json");
const livinProducts = await json<ExternalCatalogProduct[]>("data/livin-catalog.generated.json");
const shelfEvidence = [
  ...await json<ShelfEvidence[]>("data/personal-shelf-evidence.generated.json"),
  ...await json<ShelfEvidence[]>("data/personal-shelf-off-evidence.generated.json")
];
const fixedInventory: ShelfAuditIdentity[] = [
  ...barboraSlugs.map((slug) => {
    const row = barboraBySlug.get(slug);
    return { id: `barbora:${slug}`, source: "barbora_lv", title: row?.title || slug.replaceAll("-", " "), category: row?.category || null,
      brand: row?.brand || null, packSize: row?.packSize || null, gtin: null, excluded: row?.isAdult || false };
  }),
  ...[...livinnIdentities, ...livinProducts, ...offComplete].map((row) => ({
    id: `${row.source === "open_food_facts" ? "off" : row.source}:${row.sourceProductId}`,
    source: row.source,
    title: row.title,
    aliases: row.aliases,
    category: row.category,
    brand: row.brand,
    packSize: row.packSize,
    gtin: row.gtin
  }))
];
const auditForRimi = (rows: ExternalCatalogProduct[]): ShelfAudit => ({
  checkedAt: new Date().toISOString(),
  ...auditShelfInventory([
    ...fixedInventory,
    ...rows.map((row) => ({ id: `rimi_lv:${row.sourceProductId}`, source: row.source, title: row.title, aliases: row.aliases,
      category: rimiShelfCategory(row.url), brand: row.brand, packSize: row.packSize, gtin: row.gtin }))
  ], shelfEvidence)
});
const previousIds = sourceIds(previousRimi);
const currentIds = sourceIds(currentRimi);
const addedCompleteIds = difference(currentIds, previousIds);
const removedCompleteIds = difference(previousIds, currentIds);
const identityGtins = rimiIdentities.flatMap((row) => validWebGtin(row.gtin) ? [row.gtin!] : []);
const beforeAudit = auditForRimi(previousRimi);
const afterAudit = auditForRimi(currentRimi);

const report = {
  generatedAt: new Date().toISOString(),
  baselineRevision,
  scope: {
    cspIncluded: false,
    rimiCategories: [...new Set(currentRimi.map((row) => topCategory(row.url)))].sort(),
    expandedCategories
  },
  rimi: {
    previousCompleteProducts: previousRimi.length,
    currentCompleteProducts: currentRimi.length,
    addedCompleteProducts: addedCompleteIds.length,
    removedCompleteProducts: removedCompleteIds.length,
    retainedCompleteProducts: currentRimi.length - addedCompleteIds.length,
    addedCompleteIds,
    removedCompleteIds,
    identityOnlyProducts: rimiIdentities.length,
    identityOnlyWithValidGtin: identityGtins.length,
    identityOnlyBridgedToCompleteOffByGtin: identityGtins.filter((gtin) => completeOffGtins.has(gtin)).length,
    expandedCategoryCompleteProducts: Object.fromEntries(expandedCategories.map((category) => [category, currentRimi.filter((row) => topCategory(row.url) === category).length])),
    expandedCategoryIdentityOnlyProducts: Object.fromEntries(expandedCategories.map((category) => [category, rimiIdentities.filter((row) => topCategory(row.url) === category).length])),
    currentSnapshotSha256: sha256(currentRimi),
    identitySnapshotSha256: sha256(rimiIdentities)
  },
  lidlPilot: {
    ...lidlReport,
    identityOnlyWithValidGtin: lidlIdentities.filter((row) => validWebGtin(row.gtin)).length,
    fullImportRecommended: false,
    decisionReason: lidlReport.completeProducts === 0
      ? "The current official product sitemap contains no nutrition-complete food page, so a larger import would not add rated products."
      : "The current official product sitemap is too small to justify a separate full import."
  },
  personalFit: {
    baselineCatalog: auditSlice(beforeAudit),
    expandedCatalog: auditSlice(afterAudit),
    assessableDelta: beforeAudit && afterAudit ? afterAudit.summary.assessable - beforeAudit.summary.assessable : null
  },
  limits: [
    "Retailer rows are source observations, not globally unique products.",
    "Identity-only products never receive invented nutrition or a Personal Shelf score.",
    "Rimi and Lidl snapshots remain non-redistributable without retailer permission.",
    "The Lidl pilot used every URL exposed by the current official product sitemap even though the requested cap was 100."
  ]
};

await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(`${output}.tmp`, `${JSON.stringify(report, null, 2)}\n`);
await rename(`${output}.tmp`, output);
console.log(JSON.stringify({ output, rimi: report.rimi, lidlPilot: report.lidlPilot, personalFit: report.personalFit }, null, 2));
