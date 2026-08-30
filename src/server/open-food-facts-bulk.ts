import type { ExternalCatalogProduct } from "./external-catalog-types";

export interface OpenFoodFactsBulkRecord {
  code?: string;
  product_name?: string;
  product_name_lv?: string;
  brands?: string;
  quantity?: string;
  categories?: string;
  countries?: string;
  countries_tags?: string[];
  image_front_url?: string;
  nutrition_data_per?: string;
  nutriments?: {
    "energy-kcal_100g"?: number;
    "energy-kj_100g"?: number;
    proteins_100g?: number;
    sugars_100g?: number;
    carbohydrates_100g?: number;
  };
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function isLatviaOpenFoodFactsRecord(record: OpenFoodFactsBulkRecord): boolean {
  const tags = record.countries_tags || [];
  return tags.some((tag) => ["en:latvia", "lv:latvija"].includes(tag.toLowerCase())) || /\blatvia\b|\blatvija\b/i.test(record.countries || "");
}

export function openFoodFactsBulkRecordToProduct(
  record: OpenFoodFactsBulkRecord,
  checkedAt = new Date().toISOString()
): ExternalCatalogProduct | null {
  const code = record.code?.trim() || "";
  const title = record.product_name_lv?.trim() || record.product_name?.trim() || "";
  const protein = finite(record.nutriments?.proteins_100g);
  const sugar = finite(record.nutriments?.sugars_100g);
  const kcal = finite(record.nutriments?.["energy-kcal_100g"]);
  const kilojoules = finite(record.nutriments?.["energy-kj_100g"]);
  const energy = kcal ?? (kilojoules === null ? null : Math.round((kilojoules / 4.184) * 10) / 10);
  if (!/^\d{8,14}$/.test(code) || !title || protein === null || sugar === null || energy === null) return null;
  return {
    source: "open_food_facts",
    sourceProductId: code,
    retailer: null,
    url: `https://world.openfoodfacts.org/product/${code}`,
    title,
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
