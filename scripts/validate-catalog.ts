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

async function externalSnapshot(file: string, source: "rimi_lv" | "livin_lv" | "open_food_facts", minimum: number) {
  const products = z.array(externalProductSchema).min(minimum).parse(JSON.parse(await readFile(file, "utf8")));
  if (products.some((product) => product.source !== source)) throw new Error(`${file} mixes catalog source layers`);
  if (new Set(products.map((product) => product.sourceProductId)).size !== products.length) {
    throw new Error(`${file} contains duplicate source product IDs`);
  }
  return products;
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
  console.log(`Rimi verified snapshot: ${rimi.length}`);
  console.log(`Livin verified snapshot: ${livin.length}`);
  console.log(`Open Food Facts Latvia ODbL layer: ${openFoodFacts.length}`);
  if (process.argv.includes("--require-complete") && complete.length !== products.length) {
    throw new Error("Catalog is not ready for public two-factor fit scores");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
