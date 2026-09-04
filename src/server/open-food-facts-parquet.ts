import { validWebGtin, webPack } from "./web-product-evidence";
import { hasContradictoryShelfNutrition } from "../lib/personal-shelf-rank";
import { isOpenFoodFactsMarketRecord, openFoodFactsBulkRecordToProduct, type OpenFoodFactsBulkRecord } from "./open-food-facts-bulk";

type TranslatedText = { lang: string; text: string };
type Nutrient = { name: string; "100g": number | null; unit?: string; prepared_100g?: number | null };
export interface OffParquetRow {
  code: string;
  brands: string | null;
  categories: string | null;
  categories_tags?: string[];
  countries_tags: string[];
  lang: string | null;
  product_name: TranslatedText[];
  ingredients_text: TranslatedText[];
  quantity: string | null;
  product_quantity_unit: string | null;
  nutrition_data_per: string | null;
  nutriments: Nutrient[];
  obsolete?: boolean;
  no_nutrition_data?: boolean;
  data_quality_errors_tags?: string[];
  last_modified_t?: number;
}

/** Preserve the actual labelled language. Different text for one language is ambiguous. */
function translations(items: TranslatedText[] | null | undefined): Map<string, string> | null {
  const result = new Map<string, string>();
  for (const row of items || []) {
    if (!row || typeof row.lang !== "string" || typeof row.text !== "string" || !row.text.trim()) continue;
    if (result.has(row.lang) && result.get(row.lang) !== row.text.trim()) return null;
    result.set(row.lang, row.text.trim());
  }
  return result;
}

export function offParquetProduct(row: OffParquetRow, checkedAt: string) {
  if (!validWebGtin(row.code)) return { product: null, reason: "invalid_gtin" } as const;
  if (!isOpenFoodFactsMarketRecord({ countries_tags: row.countries_tags }, ["latvia", "lithuania", "belarus"])) return { product: null, reason: "outside_markets" } as const;
  if (row.obsolete || row.no_nutrition_data || row.data_quality_errors_tags?.length) return { product: null, reason: "source_quality_flag" } as const;
  if (!row.brands?.trim()) return { product: null, reason: "missing_brand" } as const;
  if ([...(row.categories_tags || []), row.categories || ""].some((tag) => /(?:pet|cat|dog|animal)[ -]foods?|non[ -]food/i.test(tag))) return { product: null, reason: "not_human_food" } as const;
  const names = translations(row.product_name);
  const ingredients = translations(row.ingredients_text);
  if (!names || !ingredients) return { product: null, reason: "ambiguous_language_text" } as const;
  const pack = webPack(row.quantity || "");
  const unit = row.product_quantity_unit?.toLowerCase();
  const explicitBasis = unit === "g" || unit === "kg" ? "100g" : unit === "ml" || unit === "cl" || unit === "l" ? "100ml" : null;
  const packBasis = pack?.unit === "g" ? "100g" : pack?.unit === "ml" ? "100ml" : null;
  if (explicitBasis && packBasis && explicitBasis !== packBasis) return { product: null, reason: "conflicting_quantity_basis" } as const;
  // OFF exports standardized _100g fields even for labels entered per serving.
  // A known package dimension is still required; grams are never assumed for a liquid.
  const basis = explicitBasis || packBasis;
  if (!basis) return { product: null, reason: "unknown_quantity_basis" } as const;
  const nutriments: Record<string, number> = {};
  const wanted = new Set(["energy-kcal", "energy-kj", "proteins", "sugars", "carbohydrates", "fiber", "salt", "sodium", "saturated-fat", "fat"]);
  for (const nutrient of row.nutriments || []) {
    if (!wanted.has(nutrient.name) || nutrient["100g"] === null) continue;
    const n = nutrient["100g"];
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return { product: null, reason: "invalid_nutrient" } as const;
    const key = `${nutrient.name}_100g`;
    const normalized = Number(n.toPrecision(6));
    if (nutriments[key] !== undefined && nutriments[key] !== normalized) return { product: null, reason: "duplicate_nutrient_conflict" } as const;
    // Parquet FLOAT introduces binary noise; keep at most 6 significant decimal
    // digits, not rounded whole grams. Never read the separate prepared values.
    nutriments[key] = normalized;
  }
  const raw: OpenFoodFactsBulkRecord = { code: row.code, brands: row.brands, categories: row.categories || "",
    countries_tags: row.countries_tags, quantity: row.quantity || "", nutrition_data_per: basis,
    lang: row.lang, nutriments };
  for (const [language, value] of names) {
    if (language === "main") raw.product_name = value;
    else if (/^[a-z]{2}$/.test(language)) raw[`product_name_${language}`] = value;
  }
  for (const [language, value] of ingredients) {
    if (language === "main") raw.ingredients_text = value;
    else if (/^[a-z]{2}$/.test(language)) raw[`ingredients_text_${language}`] = value;
  }
  const product = openFoodFactsBulkRecordToProduct(raw, checkedAt);
  if (product && (product.energyKcal > 1000 || product.proteinG > 100 || product.totalSugarG > 100 || hasContradictoryShelfNutrition(product.shelfEvidence))) {
    return { product: null, reason: "inconsistent_source_table" } as const;
  }
  return product ? { product, reason: null } as const : { product: null, reason: "missing_core_nutrition_or_name" } as const;
}
