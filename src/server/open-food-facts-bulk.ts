import type { ExternalCatalogProduct } from "./external-catalog-types";
import { offShelfEvidence } from "./personal-shelf-parser";

export interface OpenFoodFactsBulkRecord {
  [key: string]: unknown;
  code?: string;
  product_name?: string;
  product_name_lv?: string;
  product_name_en?: string;
  product_name_ru?: string;
  product_name_lt?: string;
  product_name_et?: string;
  brands?: string;
  quantity?: string;
  categories?: string;
  countries?: string;
  countries_tags?: string[];
  image_front_url?: string;
  nutrition_data_per?: string;
  nutriments?: {
    [nutrient: string]: unknown;
    "energy-kcal_100g"?: number;
    "energy-kj_100g"?: number;
    proteins_100g?: number;
    sugars_100g?: number;
    carbohydrates_100g?: number;
  };
}

export type OpenFoodFactsMarket = "latvia" | "lithuania" | "belarus";

const marketEvidence: Record<OpenFoodFactsMarket, { tags: string[]; countryText: RegExp }> = {
  latvia: {
    tags: ["en:latvia", "lv:latvija"],
    countryText: /\blatvia\b|\blatvija\b/i
  },
  lithuania: {
    tags: ["en:lithuania", "lt:lietuva"],
    countryText: /\blithuania\b|\blietuva\b/i
  },
  belarus: {
    tags: ["en:belarus", "ru:belarus", "be:belarus"],
    countryText: /\bbelarus\b|беларусь|белоруссия/i
  }
};

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

const preferredProductNameFields = [
  "product_name_lv",
  "product_name_en",
  "product_name_ru",
  "product_name_lt",
  "product_name_et",
  "product_name"
] as const;

function normalizedNameKey(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

export function openFoodFactsProductNames(record: object): string[] {
  const values = new Map<string, string>();
  const add = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = normalizedNameKey(trimmed);
    if (!values.has(key)) values.set(key, trimmed);
  };

  const source = record as Record<string, unknown>;
  for (const field of preferredProductNameFields) add(source[field]);
  for (const [field, value] of Object.entries(source).sort(([left], [right]) => left.localeCompare(right))) {
    if (/^product_name_[a-z]{2}$/i.test(field)) add(value);
  }
  return [...values.values()];
}

export function isLatviaOpenFoodFactsRecord(record: OpenFoodFactsBulkRecord): boolean {
  return isOpenFoodFactsMarketRecord(record, ["latvia"]);
}

export function isOpenFoodFactsMarketRecord(
  record: OpenFoodFactsBulkRecord,
  markets: OpenFoodFactsMarket[]
): boolean {
  const tags = new Set((record.countries_tags || []).map((tag) => tag.toLowerCase()));
  const countryText = record.countries || "";
  return markets.some((market) => {
    const evidence = marketEvidence[market];
    return evidence.tags.some((tag) => tags.has(tag)) || evidence.countryText.test(countryText);
  });
}

export function openFoodFactsBulkRecordToProduct(
  record: OpenFoodFactsBulkRecord,
  checkedAt = new Date().toISOString()
): ExternalCatalogProduct | null {
  const code = record.code?.trim() || "";
  const names = openFoodFactsProductNames(record);
  const title = names[0] || "";
  const protein = finite(record.nutriments?.proteins_100g);
  const sugar = finite(record.nutriments?.sugars_100g);
  const kcal = finite(record.nutriments?.["energy-kcal_100g"]);
  const kilojoules = finite(record.nutriments?.["energy-kj_100g"]);
  const energy = kcal ?? (kilojoules === null ? null : Math.round((kilojoules / 4.184) * 10) / 10);
  if (!/^\d{8,14}$/.test(code) || !title || protein === null || sugar === null || energy === null) return null;
  return {
    source: "open_food_facts",
    shelfEvidence: offShelfEvidence(record, checkedAt),
    sourceProductId: code,
    retailer: null,
    url: `https://world.openfoodfacts.org/product/${code}`,
    title,
    aliases: names.slice(1),
    brand: record.brands?.split(",")[0]?.trim() || "Open Food Facts",
    gtin: code,
    sku: null,
    category: record.categories?.trim() || null,
    packSize: record.quantity?.trim() || "",
    nutritionBasis: record.nutrition_data_per === "100ml" ? "100ml" : "100g",
    energyKcal: energy,
    proteinG: protein,
    totalSugarG: sugar,
    carbohydrateG: finite(record.nutriments?.carbohydrates_100g),
    imageUrl: record.image_front_url?.trim() || null,
    price: null,
    currency: null,
    available: null,
    checkedAt
  };
}
