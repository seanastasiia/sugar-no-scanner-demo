import { readFile } from "node:fs/promises";
import { z } from "zod";

const sourceSchema = z.object({
  label: z.string().min(1),
  url: z.url(),
  checkedAt: z.iso.date(),
  fields: z.array(z.enum(["identity", "protein", "fiber", "totalSugar", "claim", "retailerUrl"])),
  status: z.enum(["verified", "secondary", "pending"])
});

const productSchema = z.object({
  id: z.string().min(1),
  retailerProductId: z.string().min(1),
  brand: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  aliases: z.array(z.string()),
  format: z.enum(["bar", "cookie", "truffle", "puree"]),
  packSizeG: z.number().positive(),
  gtin: z.string().nullable(),
  nutrientsPer100g: z.object({
    proteinG: z.number().nonnegative().nullable(),
    fiberG: z.number().nonnegative().nullable(),
    totalSugarG: z.number().nonnegative().nullable()
  }),
  noAddedSugarClaim: z.boolean(),
  imageUrl: z.url().nullable(),
  retailerUrl: z.url(),
  sources: z.array(sourceSchema).min(1),
  isGolden: z.boolean(),
  accent: z.string().min(1)
});

const externalProductSchema = z.object({
  source: z.enum(["rimi_lv", "livin_lv", "open_food_facts"]),
  sourceProductId: z.string().min(1),
  retailer: z.enum(["Rimi", "Livin"]).nullable(),
  url: z.url(),
  title: z.string().min(1),
  brand: z.string().min(1),
  gtin: z.string().regex(/^\d{8,14}$/).nullable(),
  sku: z.string().nullable(),
  category: z.string().nullable(),
  packSize: z.string(),
  nutritionBasis: z.enum(["100g", "100ml"]),
  energyKcal: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  totalSugarG: z.number().nonnegative(),
  imageUrl: z.url().nullable(),
  price: z.number().nonnegative().nullable(),
  currency: z.literal("EUR").nullable(),
  available: z.boolean().nullable(),
  checkedAt: z.iso.datetime()
});

const catalogSourceManifestSchema = z.object({
  id: z.enum(["barbora_lv", "rimi_lv", "livin_lv", "open_food_facts"]),
  displayName: z.string().min(1),
  layer: z.enum(["retailer_snapshot", "odbl_bulk"]),
  license: z.string().min(1),
  attribution: z.string().min(1),
  termsUrl: z.url().startsWith("https://"),
  dataUrl: z.url().startsWith("https://"),
  redistributable: z.boolean()
});

const retailerSyncReportSchema = z.object({
  source: z.enum(["rimi", "livin"]),
  categories: z.array(z.string().min(1)).min(1).nullable(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
  checkedAt: z.iso.datetime(),
  discoveredUrls: z.number().int().positive(),
  processedUrls: z.number().int().positive(),
  completeProducts: z.number().int().positive(),
  skippedWithoutCompleteNutrition: z.number().int().nonnegative(),
  notFoundUrls: z.number().int().nonnegative(),
  failedUrls: z.literal(0),
  requestSpacingMs: z.number().int().min(100),
  concurrency: z.number().int().min(1).max(8)
});

const rimiScopedCategories = [
  "gala-zivis-un-gatava-kulinarija",
  "piena-produkti-un-olas",
  "maize-un-konditoreja",
  "saldetie-edieni",
  "iepakota-partika",
  "saldumi-un-uzkodas",
  "dzerieni"
];

async function externalSnapshot(file: string, source: "rimi_lv" | "livin_lv" | "open_food_facts", minimum: number) {
  const products = z.array(externalProductSchema).min(minimum).parse(JSON.parse(await readFile(file, "utf8")));
  if (products.some((product) => product.source !== source)) throw new Error(`${file} mixes catalog source layers`);
  if (new Set(products.map((product) => product.sourceProductId)).size !== products.length) {
    throw new Error(`${file} contains duplicate source product IDs`);
  }
  return products;
}

async function completedRetailerSync(
  file: string,
  source: "rimi" | "livin",
  completeProducts: number
) {
  const report = retailerSyncReportSchema.parse(JSON.parse(await readFile(file, "utf8")));
  if (report.source !== source) throw new Error(`${file} belongs to ${report.source}, not ${source}`);
  if (report.processedUrls !== report.discoveredUrls) throw new Error(`${file} does not cover its complete configured URL scope`);
  if (report.completeProducts !== completeProducts) throw new Error(`${file} does not match its generated snapshot`);
  if (report.completeProducts + report.skippedWithoutCompleteNutrition + report.notFoundUrls !== report.processedUrls) {
    throw new Error(`${file} coverage totals do not reconcile`);
  }
  return report;
}

async function main() {
  const products = z.array(productSchema).length(40).parse(
    JSON.parse(await readFile("data/catalog.generated.json", "utf8"))
  );
  const barboraIndex = z.array(z.string().regex(/^[a-z0-9-]+$/)).min(10_000).parse(
    JSON.parse(await readFile("data/barbora-product-index.generated.json", "utf8"))
  );
  const [rimi, livin, openFoodFacts] = await Promise.all([
    externalSnapshot("data/rimi-catalog.generated.json", "rimi_lv", 500),
    externalSnapshot("data/livin-catalog.generated.json", "livin_lv", 6),
    externalSnapshot("data/open-food-facts-lv.generated.json", "open_food_facts", 500)
  ]);
  const sourceManifests = z.array(catalogSourceManifestSchema).length(4).parse(
    JSON.parse(await readFile("data/catalog-sources.generated.json", "utf8"))
  );
  if (new Set(sourceManifests.map((source) => source.id)).size !== sourceManifests.length) {
    throw new Error("Catalog source manifests must have unique IDs");
  }
  const barboraSource = sourceManifests.find((source) => source.id === "barbora_lv")!;
  const rimiSource = sourceManifests.find((source) => source.id === "rimi_lv")!;
  const livinSource = sourceManifests.find((source) => source.id === "livin_lv")!;
  const offSource = sourceManifests.find((source) => source.id === "open_food_facts")!;
  if (barboraSource.redistributable || rimiSource.redistributable || livinSource.redistributable) {
    throw new Error("Retailer snapshots must remain non-redistributable without permission");
  }
  if (!offSource.redistributable || !/ODbL|Open Database License/i.test(offSource.license) || !/CC BY-SA/i.test(offSource.license)) {
    throw new Error("Open Food Facts manifest must retain database and product-image license notices");
  }
  for (const [file, snapshot] of [
    ["Rimi", rimi],
    ["Livin", livin],
    ["Open Food Facts", openFoodFacts]
  ] as const) {
    if (snapshot.some((product) => product.imageUrl && !product.imageUrl.startsWith("https://"))) {
      throw new Error(`${file} snapshot contains a non-HTTPS product image`);
    }
  }
  const [rimiReport, livinReport] = await Promise.all([
    completedRetailerSync("data/rimi-catalog-sync-report.generated.json", "rimi", rimi.length),
    completedRetailerSync("data/livin-catalog-sync-report.generated.json", "livin", livin.length)
  ]);
  if (JSON.stringify(rimiReport.categories) !== JSON.stringify(rimiScopedCategories)) {
    throw new Error("Rimi snapshot does not match the approved seven-category scope");
  }
  if (livinReport.categories !== null) throw new Error("Livin sync must cover its complete Latvia product sitemap");
  const allowedRimiCategories = new Set(rimiScopedCategories);
  if (rimi.some((product) => !allowedRimiCategories.has(product.category?.split(" > ")[0] || ""))) {
    throw new Error("Rimi snapshot contains a product outside the approved category scope");
  }
  const uniqueIds = new Set(products.map((product) => product.id));
  const uniqueRetailerIds = new Set(products.map((product) => product.retailerProductId));
  if (uniqueIds.size !== products.length || uniqueRetailerIds.size !== products.length) {
    throw new Error("Catalog IDs must be unique");
  }
  if (new Set(barboraIndex).size !== barboraIndex.length) {
    throw new Error("Barbora index slugs must be unique");
  }
  const complete = products.filter(
    (product) => Number.isFinite(product.nutrientsPer100g.proteinG) && Number.isFinite(product.nutrientsPer100g.totalSugarG)
  );
  const withFiber = products.filter((product) => Number.isFinite(product.nutrientsPer100g.fiberG));
  console.log(`Catalog rows: ${products.length}`);
  console.log(`Complete two-factor fit nutrition: ${complete.length}`);
  console.log(`Optional raw fiber data: ${withFiber.length}`);
  console.log(`Barbora product index: ${barboraIndex.length}`);
  console.log(`Rimi verified snapshot: ${rimi.length} from ${rimiReport.processedUrls} sitemap pages`);
  console.log(`Livin verified snapshot: ${livin.length} from ${livinReport.processedUrls} sitemap pages`);
  console.log(`Open Food Facts Latvia ODbL layer: ${openFoodFacts.length}`);
  if (process.argv.includes("--require-complete") && complete.length !== products.length) {
    throw new Error("Catalog is not ready for public two-factor fit scores");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
