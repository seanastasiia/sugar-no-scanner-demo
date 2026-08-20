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

async function main() {
  const products = z.array(productSchema).length(40).parse(
    JSON.parse(await readFile("data/catalog.generated.json", "utf8"))
  );
  const uniqueIds = new Set(products.map((product) => product.id));
  const uniqueRetailerIds = new Set(products.map((product) => product.retailerProductId));
  if (uniqueIds.size !== products.length || uniqueRetailerIds.size !== products.length) {
    throw new Error("Catalog IDs must be unique");
  }
  const complete = products.filter((product) => Object.values(product.nutrientsPer100g).every(Number.isFinite));
  const missingFiber = products.filter((product) => product.nutrientsPer100g.fiberG === null);
  console.log(`Catalog rows: ${products.length}`);
  console.log(`Complete Match nutrition: ${complete.length}`);
  console.log(`Pending fiber verification: ${missingFiber.length}`);
  if (process.argv.includes("--require-complete") && complete.length !== products.length) {
    throw new Error("Catalog is not ready for public Match scores");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
