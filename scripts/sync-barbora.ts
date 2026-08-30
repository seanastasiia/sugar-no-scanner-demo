import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProductFormat, ProductRecord, ProductSource } from "../src/lib/types";

const categoryUrl =
  "https://barbora.lv/bakaleja/speciala-partika/produkti-ar-augstu-proteina-saturu";
const checkedAt = process.env.CATALOG_CHECKED_AT || new Date().toISOString().slice(0, 10);
const outputPath = path.resolve("data/catalog.generated.json");
const overridePath = path.resolve("data/fiber-overrides.json");

interface BarboraListProduct {
  id: string;
  title: string;
  brand_name: string;
  Url: string;
}

interface BarboraProduct extends BarboraListProduct {
  description: string;
  gallery: string[];
  attributes?: {
    list?: Array<{ id: string; value: string; group: number }>;
    additional?: Record<string, boolean>;
  };
  nutrients: Array<{
    Name: string;
    Amounts: Array<{ Amount: number; UnitName: string }>;
  }>;
}

interface FiberOverride {
  fiberG: number;
  label: string;
  url: string;
  checkedAt: string;
  status: "verified" | "secondary";
}

function extractJson<T>(html: string, variableName: string): T {
  const pattern = new RegExp(`window\\.${variableName} = ([\\[{].*?[\\]}]);`, "s");
  const match = html.match(pattern);
  if (!match) throw new Error(`Could not find window.${variableName}`);
  return JSON.parse(match[1]) as T;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Sugar.no Latvia catalog research demo/0.1"
    },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

function grams(product: BarboraProduct, label: string): number | null {
  const nutrient = product.nutrients.find((item) => item.Name === label);
  const amount = nutrient?.Amounts.find((item) => item.UnitName === "g")?.Amount;
  return typeof amount === "number" ? amount : null;
}

function packSize(product: BarboraProduct): number {
  const attribute = product.attributes?.list?.find((item) => item.id === "Neto daudzums (g/ml)")?.value;
  const fromAttribute = attribute ? Number.parseFloat(attribute.replace(",", ".")) : Number.NaN;
  if (Number.isFinite(fromAttribute)) return fromAttribute;
  const fromTitle = product.title.match(/(\d+(?:[.,]\d+)?)\s*(?:g|ml)\b/i)?.[1];
  return fromTitle ? Number.parseFloat(fromTitle.replace(",", ".")) : 0;
}

function formatFor(title: string): ProductFormat {
  if (/cepum/i.test(title)) return "cookie";
  if (/trifel/i.test(title)) return "truffle";
  if (/biezen/i.test(title)) return "puree";
  return "bar";
}

function accentFor(brand: string): string {
  const accents: Record<string, string> = {
    BAREBELLS: "violet",
    "THE BEGINNINGS": "ochre",
    GO_ON: "coral",
    ICONFIT: "blue",
    SKRĪVERU: "berry",
    SNICKERS: "cocoa",
    NUTEGO: "teal",
    FITEG2: "green",
    OSHEE: "amber",
    "PURE CHOCOLATE": "plum",
    "DR WITT": "lime"
  };
  return accents[brand.replaceAll(" ", "_")] || accents[brand] || "coral";
}

function noAddedSugarClaim(product: BarboraProduct): boolean {
  return /bez pievien[oō]t[aā] cukura/i.test(`${product.title} ${product.description || ""}`);
}

async function main() {
  const overrides = JSON.parse(await readFile(overridePath, "utf8")) as Record<string, FiberOverride>;
  const pages = await Promise.all(
    [categoryUrl, `${categoryUrl}?page=2`].map(async (url) =>
      extractJson<BarboraListProduct[]>(await fetchText(url), "b_productList")
    )
  );
  const all = pages.flat();
  const bars = all.filter((product) => /(batoni|cepum|trifel)/i.test(product.title));
  const purees = all.filter((product) => /biezen/i.test(product.title)).slice(0, 2);
  const selected = [...bars, ...purees].slice(0, 40);

  if (selected.length !== 40) {
    throw new Error(`Expected 40 selected products, received ${selected.length}`);
  }

  const products: ProductRecord[] = [];
  for (const listed of selected) {
    const retailerUrl = `https://barbora.lv/produkti/${listed.Url}`;
    const product = extractJson<BarboraProduct>(await fetchText(retailerUrl), "product");
    const fiber = overrides[listed.Url];
    const carbohydrate = grams(product, "Ogļhidrāti");
    const retailerSource: ProductSource = {
      label: "Barbora Latvia product page",
      url: retailerUrl,
      checkedAt,
      fields: [
        "identity",
        "protein",
        "totalSugar",
        ...(carbohydrate === null ? [] : (["carbohydrate"] as const)),
        "retailerUrl",
        "claim"
      ],
      status: "verified"
    };
    const sources: ProductSource[] = [retailerSource];
    if (fiber) {
      sources.push({
        label: fiber.label,
        url: fiber.url,
        checkedAt: fiber.checkedAt,
        fields: ["fiber"],
        status: fiber.status
      });
    }

    products.push({
      id: listed.Url,
      retailerProductId: product.id,
      brand: product.brand_name,
      name: product.title,
      shortName: product.title.replace(/^Proteīna\s+/i, "").replace(/\s+\d+\s*(?:g|ml)$/i, ""),
      aliases: [product.brand_name, product.title, listed.Url.replaceAll("-", " ")],
      format: formatFor(product.title),
      packSizeG: packSize(product),
      gtin: null,
      nutrientsPer100g: {
        proteinG: grams(product, "Olbaltumvielas"),
        fiberG: fiber?.fiberG ?? null,
        carbohydrateG: carbohydrate,
        totalSugarG: grams(product, "Cukuri")
      },
      noAddedSugarClaim: noAddedSugarClaim(product),
      imageUrl: product.gallery[0] || null,
      retailerUrl,
      sources,
      isGolden: Boolean(fiber),
      accent: accentFor(product.brand_name)
    });
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(products, null, 2)}\n`, "utf8");

  const complete = products.filter(
    (product) => product.nutrientsPer100g.proteinG !== null && product.nutrientsPer100g.totalSugarG !== null
  ).length;
  const withFiber = products.filter((product) => product.nutrientsPer100g.fiberG !== null).length;
  console.log(`Wrote ${products.length} Latvia products to ${outputPath}`);
  console.log(`Complete two-factor fit nutrition: ${complete}/${products.length}`);
  console.log(`Optional raw fiber data: ${withFiber}/${products.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
