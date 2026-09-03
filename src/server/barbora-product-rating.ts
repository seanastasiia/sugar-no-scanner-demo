import { scoreBarboraProduct } from "@/lib/scoring";
import type { ProductRecord, ProductSource, ScoredProduct } from "@/lib/types";
import { barboraShelfEvidence } from "./personal-shelf-parser";
import { applyShelfNutritionTrustGuard } from "@/lib/personal-shelf-rank";
import {
  getBarboraProductBySlug,
  normalizeRetailText,
  type BarboraNutrient,
  type BarboraPageProduct
} from "./barbora-catalog";
import {
  getIndexedBarboraNutrition,
  indexedBarboraProductToScoredProduct
} from "./barbora-nutrition-index";

function nutrientAmount(
  nutrients: BarboraNutrient[] | undefined,
  names: string[],
  unit = "g"
): number | null {
  const normalizedNames = names.map(normalizeRetailText);
  const nutrient = nutrients?.find((candidate) => {
    const name = normalizeRetailText(candidate.Name);
    return normalizedNames.some((expected) => name.includes(expected));
  });
  const amount = nutrient?.Amounts.find(
    (candidate) => normalizeRetailText(candidate.UnitName) === normalizeRetailText(unit)
  )?.Amount;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : null;
}

function energyKcal(nutrients: BarboraNutrient[] | undefined): number | null {
  const energy = nutrients?.find((candidate) =>
    normalizeRetailText(candidate.Name).includes("energetiska vertiba")
  );
  const kcal = energy?.Amounts.find((candidate) =>
    normalizeRetailText(candidate.UnitName).includes("kcal")
  )?.Amount;
  if (typeof kcal === "number" && Number.isFinite(kcal)) return kcal;
  const kilojoules = energy?.Amounts.find(
    (candidate) => normalizeRetailText(candidate.UnitName) === "kj"
  )?.Amount;
  return typeof kilojoules === "number" && Number.isFinite(kilojoules)
    ? Math.round((kilojoules / 4.184) * 10) / 10
    : null;
}

function netAmount(product: BarboraPageProduct): number {
  const attribute = product.attributes?.list?.find((candidate) =>
    normalizeRetailText(candidate.id).includes("neto daudzums")
  )?.value;
  const numericAttribute = attribute ? Number.parseFloat(attribute.replace(",", ".")) : Number.NaN;
  if (Number.isFinite(numericAttribute)) return numericAttribute;

  const titleAmount = product.title.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
  if (!titleAmount) return 0;
  const amount = Number.parseFloat(titleAmount[1].replace(",", "."));
  const unit = titleAmount[2].toLowerCase();
  if (unit === "kg" || unit === "l") return amount * 1_000;
  return amount;
}

function hasNoAddedSugarClaim(product: BarboraPageProduct): boolean {
  const text = normalizeRetailText(
    [product.title, product.description || "", product.ingredients || ""].join(" ")
  );
  return text.includes("bez pievienota cukura") || text.includes("no added sugar");
}

function sourceFields(product: ProductRecord): ProductSource["fields"] {
  const fields: ProductSource["fields"] = ["identity", "retailerUrl"];
  if (product.nutrientsPer100g.proteinG !== null) fields.push("protein");
  if (product.nutrientsPer100g.fiberG !== null) fields.push("fiber");
  if (product.nutrientsPer100g.totalSugarG !== null) fields.push("totalSugar");
  if (product.noAddedSugarClaim) fields.push("claim");
  return fields;
}

export function barboraPageToScoredProduct(
  product: BarboraPageProduct,
  checkedAt = new Date().toISOString()
): ScoredProduct {
  const retailerUrl = `https://barbora.lv/produkti/${product.Url}`;
  const record: ProductRecord = {
    id: `barbora:${product.Url}`,
    shelfEvidence: barboraShelfEvidence(product, checkedAt),
    retailerProductId: product.Url,
    brand: product.brand_name || "Barbora",
    name: product.title,
    shortName: product.title,
    aliases: [],
    format: "other",
    category: product.category_name_full_path || product.root_category_id || null,
    packSizeG: netAmount(product),
    nutritionBasis: product.comparative_unit?.toLowerCase() === "l" ? "100ml" : "100g",
    energyKcalPer100: energyKcal(product.nutrients),
    gtin: null,
    nutrientsPer100g: {
      proteinG: nutrientAmount(product.nutrients, ["olbaltumvielas", "protein"]),
      fiberG: nutrientAmount(product.nutrients, ["skiedrvielas", "fibre", "fiber"]),
      totalSugarG: nutrientAmount(product.nutrients, ["cukuri", "sugars"])
    },
    noAddedSugarClaim: hasNoAddedSugarClaim(product),
    imageUrl: product.image || null,
    retailerUrl,
    sources: [],
    isGolden: false,
    accent: "coral"
  };
  record.sources = [
    {
      label: "Exact Barbora product page",
      url: retailerUrl,
      checkedAt,
      fields: sourceFields(record),
      status: "secondary"
    }
  ];

  const scored = applyShelfNutritionTrustGuard(scoreBarboraProduct(record));
  if (!product.is_adult) return scored;
  return {
    ...scored,
    matchScore: null,
    matchReason: "missing_nutrition",
    ratingStatus: "identity_only",
    ratingSignalCount: 0,
    ratingSignalMask: [],
    criterionScores: null
  };
}

export async function getRatedBarboraProduct(slug: string): Promise<ScoredProduct | null> {
  const indexed = getIndexedBarboraNutrition(slug);
  if (indexed) return indexedBarboraProductToScoredProduct(indexed);
  const product = await getBarboraProductBySlug(slug);
  return product ? barboraPageToScoredProduct(product) : null;
}
