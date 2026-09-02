import { readFile } from "node:fs/promises";
import { z } from "zod";

const sourceSchema = z.object({
  label: z.string().min(1),
  url: z.url(),
  checkedAt: z.iso.date(),
  fields: z.array(z.enum(["identity", "protein", "fiber", "carbohydrate", "totalSugar", "claim", "retailerUrl"])),
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
    carbohydrateG: z.number().nonnegative().nullable().optional(),
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
  source: z.enum(["rimi_lv", "livin_lv", "livinn_lt", "open_food_facts"]),
  sourceProductId: z.string().min(1),
  retailer: z.enum(["Rimi", "Livin"]).nullable(),
  url: z.url(),
  title: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  brand: z.string().min(1),
  gtin: z.string().regex(/^\d{8,14}$/).nullable(),
  sku: z.string().nullable(),
  category: z.string().nullable(),
  packSize: z.string(),
  nutritionBasis: z.enum(["100g", "100ml"]),
  energyKcal: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbohydrateG: z.number().nonnegative().nullable().optional(),
  totalSugarG: z.number().nonnegative(),
  imageUrl: z.url().nullable(),
  price: z.number().nonnegative().nullable(),
  currency: z.literal("EUR").nullable(),
  available: z.boolean().nullable(),
  checkedAt: z.iso.datetime()
});

const externalIdentitySchema = z.object({
  source: z.literal("livinn_lt"),
  sourceProductId: z.string().min(1),
  retailer: z.literal("Livin"),
  url: z.url(),
  title: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  brand: z.string().min(1),
  gtin: z.string().regex(/^\d{8,14}$/).nullable(),
  sku: z.string().min(1),
  category: z.string().min(1),
  packSize: z.string(),
  imageUrl: z.url().nullable(),
  price: z.number().nonnegative().nullable(),
  currency: z.literal("EUR").nullable(),
  available: z.boolean().nullable(),
  checkedAt: z.iso.datetime()
});

const catalogSourceManifestSchema = z.object({
  id: z.enum(["barbora_lv", "rimi_lv", "livin_lv", "livinn_lt", "open_food_facts"]),
  displayName: z.string().min(1),
  layer: z.enum(["retailer_snapshot", "odbl_bulk"]),
  license: z.string().min(1),
  attribution: z.string().min(1),
  termsUrl: z.url().startsWith("https://"),
  dataUrl: z.url().startsWith("https://"),
  redistributable: z.boolean()
});

const retailerSyncReportSchema = z.object({
  source: z.enum(["rimi", "livin", "livinn"]),
  categories: z.array(z.string().min(1)).min(1).nullable(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
  checkedAt: z.iso.datetime(),
  discoveredUrls: z.number().int().positive(),
  processedUrls: z.number().int().positive(),
  completeProducts: z.number().int().positive(),
  foodProducts: z.number().int().positive().optional(),
  nonFoodOrUnclassifiedPages: z.number().int().nonnegative().optional(),
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

async function externalSnapshot(file: string, source: "rimi_lv" | "livin_lv" | "livinn_lt" | "open_food_facts", minimum: number) {
  const products = z.array(externalProductSchema).min(minimum).parse(JSON.parse(await readFile(file, "utf8")));
  if (products.some((product) => product.source !== source)) throw new Error(`${file} mixes catalog source layers`);
  if (new Set(products.map((product) => product.sourceProductId)).size !== products.length) {
    throw new Error(`${file} contains duplicate source product IDs`);
  }
  return products;
}

async function completedRetailerSync(
  file: string,
  source: "rimi" | "livin" | "livinn",
  completeProducts: number
) {
  const report = retailerSyncReportSchema.parse(JSON.parse(await readFile(file, "utf8")));
  if (report.source !== source) throw new Error(`${file} belongs to ${report.source}, not ${source}`);
  if (report.processedUrls !== report.discoveredUrls) throw new Error(`${file} does not cover its complete configured URL scope`);
  if (report.completeProducts !== completeProducts) throw new Error(`${file} does not match its generated snapshot`);
  if (source === "livinn") {
    if (report.foodProducts === undefined || report.nonFoodOrUnclassifiedPages === undefined) {
      throw new Error(`${file} is missing the complete food identity coverage totals`);
    }
    if (report.completeProducts + report.skippedWithoutCompleteNutrition !== report.foodProducts) {
      throw new Error(`${file} food nutrition totals do not reconcile`);
    }
    if (report.foodProducts + report.nonFoodOrUnclassifiedPages + report.notFoundUrls !== report.processedUrls) {
      throw new Error(`${file} page coverage totals do not reconcile`);
    }
  } else if (report.completeProducts + report.skippedWithoutCompleteNutrition + report.notFoundUrls !== report.processedUrls) {
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
  const [rimi, livin, livinn, openFoodFacts, regionalOpenFoodFacts] = await Promise.all([
    externalSnapshot("data/rimi-catalog.generated.json", "rimi_lv", 500),
    externalSnapshot("data/livin-catalog.generated.json", "livin_lv", 6),
    externalSnapshot("data/livinn-catalog.generated.json", "livinn_lt", 500),
    externalSnapshot("data/open-food-facts-lv.generated.json", "open_food_facts", 500),
    externalSnapshot("data/open-food-facts-regional.generated.json", "open_food_facts", 0)
  ]);
  const livinnFoodIndex = z.array(externalIdentitySchema).min(500).parse(
    JSON.parse(await readFile("data/livinn-food-index.generated.json", "utf8"))
  );
  if (new Set(livinnFoodIndex.map((product) => product.sourceProductId)).size !== livinnFoodIndex.length) {
    throw new Error("Livinn Lithuania food index contains duplicate source product IDs");
  }
  if (new Set(livinnFoodIndex.map((product) => product.gtin)).size !== livinnFoodIndex.length) {
    throw new Error("Livinn Lithuania food index contains duplicate GTINs");
  }
  if (livinnFoodIndex.some((product) => !product.category.toLocaleLowerCase("lt").startsWith("maistas"))) {
    throw new Error("Livinn Lithuania food index contains a non-food source category");
  }
  for (const product of livinnFoodIndex) {
    const normalizedNames = [product.title, ...product.aliases]
      .map((name) => name.normalize("NFKC").trim().toLocaleLowerCase());
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      throw new Error(`Livinn Lithuania ${product.sourceProductId} contains duplicate language names`);
    }
  }
  const livinnIdentityIds = new Set(livinnFoodIndex.map((product) => product.sourceProductId));
  if (livinn.some((product) => !livinnIdentityIds.has(product.sourceProductId))) {
    throw new Error("Livinn Lithuania nutrition snapshot contains a product outside its food identity index");
  }
  const expectedLivinnProducts = new Map([
    ["1AM092401277", { proteinG: 12, totalSugarG: 2, carbohydrateG: 67 }],
    ["1G1701009280", { proteinG: 8.1, totalSugarG: 1.8, carbohydrateG: 75 }],
    ["SOTT0299", { proteinG: 3.4, totalSugarG: 1.5, carbohydrateG: 66 }]
  ]);
  for (const [id, expected] of expectedLivinnProducts) {
    const product = livinn.find((candidate) => candidate.sourceProductId === id);
    if (!product || product.proteinG !== expected.proteinG || product.totalSugarG !== expected.totalSugarG || product.carbohydrateG !== expected.carbohydrateG) {
      throw new Error(`Livinn Lithuania representative product ${id} is missing or changed`);
    }
  }
  const sourceManifests = z.array(catalogSourceManifestSchema).length(5).parse(
    JSON.parse(await readFile("data/catalog-sources.generated.json", "utf8"))
  );
  if (new Set(sourceManifests.map((source) => source.id)).size !== sourceManifests.length) {
    throw new Error("Catalog source manifests must have unique IDs");
  }
  const barboraSource = sourceManifests.find((source) => source.id === "barbora_lv")!;
  const rimiSource = sourceManifests.find((source) => source.id === "rimi_lv")!;
  const livinSource = sourceManifests.find((source) => source.id === "livin_lv")!;
  const livinnSource = sourceManifests.find((source) => source.id === "livinn_lt")!;
  const offSource = sourceManifests.find((source) => source.id === "open_food_facts")!;
  if (barboraSource.redistributable || rimiSource.redistributable || livinSource.redistributable || livinnSource.redistributable) {
    throw new Error("Retailer snapshots must remain non-redistributable without permission");
  }
  if (!offSource.redistributable || !/ODbL|Open Database License/i.test(offSource.license) || !/CC BY-SA/i.test(offSource.license)) {
    throw new Error("Open Food Facts manifest must retain database and product-image license notices");
  }
  const combinedOpenFoodFacts = [
    ...new Map(
      [...openFoodFacts, ...regionalOpenFoodFacts]
        .map((product) => [product.gtin || product.sourceProductId, product] as const)
    ).values()
  ];
  const multilingualOpenFoodFacts = combinedOpenFoodFacts.filter((product) => (product.aliases || []).length > 0);
  if (multilingualOpenFoodFacts.length < Math.ceil(combinedOpenFoodFacts.length * 0.1)) {
    throw new Error("Open Food Facts snapshot lost multilingual product_name aliases");
  }
  for (const product of multilingualOpenFoodFacts) {
    const normalizedNames = [product.title, ...(product.aliases || [])]
      .map((name) => name.normalize("NFKC").trim().toLocaleLowerCase());
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      throw new Error(`Open Food Facts ${product.sourceProductId} contains duplicate multilingual names`);
    }
  }
  for (const [file, snapshot] of [
    ["Rimi", rimi],
    ["Livin", livin],
    ["Livinn Lithuania", livinn],
    ["Open Food Facts", combinedOpenFoodFacts]
  ] as const) {
    if (snapshot.some((product) => product.imageUrl && !product.imageUrl.startsWith("https://"))) {
      throw new Error(`${file} snapshot contains a non-HTTPS product image`);
    }
  }
  const [rimiReport, livinReport, livinnReport] = await Promise.all([
    completedRetailerSync("data/rimi-catalog-sync-report.generated.json", "rimi", rimi.length),
    completedRetailerSync("data/livin-catalog-sync-report.generated.json", "livin", livin.length),
    completedRetailerSync("data/livinn-catalog-sync-report.generated.json", "livinn", livinn.length)
  ]);
  if (JSON.stringify(rimiReport.categories) !== JSON.stringify(rimiScopedCategories)) {
    throw new Error("Rimi snapshot does not match the approved seven-category scope");
  }
  if (livinReport.categories !== null) throw new Error("Livin sync must cover its complete Latvia product sitemap");
  if (livinnReport.categories !== null) throw new Error("Livinn sync must cover its complete Lithuania product sitemap");
  if (livinnReport.foodProducts !== livinnFoodIndex.length) {
    throw new Error("Livinn sync report does not match its complete food identity index");
  }
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
  const withCarbohydrates = products.filter((product) => Number.isFinite(product.nutrientsPer100g.carbohydrateG));
  console.log(`Catalog rows: ${products.length}`);
  console.log(`Complete two-factor fit nutrition: ${complete.length}`);
  console.log(`Optional raw fiber data: ${withFiber.length}`);
  console.log(`Optional source-backed carbohydrate data: ${withCarbohydrates.length}`);
  console.log(`Barbora product index: ${barboraIndex.length}`);
  console.log(`Rimi verified snapshot: ${rimi.length} from ${rimiReport.processedUrls} sitemap pages`);
  console.log(`Livin verified snapshot: ${livin.length} from ${livinReport.processedUrls} sitemap pages`);
  console.log(`Livinn Lithuania verified snapshot: ${livinn.length} from ${livinnReport.processedUrls} sitemap pages`);
  console.log(`Livinn Lithuania edible identity index: ${livinnFoodIndex.length}`);
  console.log(`Open Food Facts Latvia ODbL layer: ${openFoodFacts.length}`);
  console.log(`Open Food Facts Lithuania/Belarus ODbL layer: ${regionalOpenFoodFacts.length}`);
  console.log(`Open Food Facts rows with multilingual aliases: ${multilingualOpenFoodFacts.length}`);
  if (process.argv.includes("--require-complete") && complete.length !== products.length) {
    throw new Error("Catalog is not ready for public two-factor fit scores");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
