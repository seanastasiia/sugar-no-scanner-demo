import { normalizeRetailText } from "./barbora-catalog";
import { validWebGtin, webPack } from "./web-product-evidence";
import { openFoodFactsProductNames, type OpenFoodFactsBulkRecord } from "./open-food-facts-bulk";
import { offShelfEvidence } from "./personal-shelf-parser";

/** A later OFF response must still describe the same source name, brand and pack. */
export function exactOffEvidence(raw: OpenFoodFactsBulkRecord, expected: { code: string; brand: string; title: string; aliases?: string[]; packSize: string }, checkedAt: string) {
  if (!validWebGtin(expected.code) || raw.code !== expected.code) return null;
  if (raw.obsolete || raw.no_nutrition_data || (Array.isArray(raw.data_quality_errors_tags) && raw.data_quality_errors_tags.length)) return null;
  const brands = (raw.brands || "").split(",").map(normalizeRetailText);
  if (!brands.includes(normalizeRetailText(expected.brand))) return null;
  const names = new Set(openFoodFactsProductNames(raw).map(normalizeRetailText));
  if (![expected.title, ...(expected.aliases || [])].some((name) => names.has(normalizeRetailText(name)))) return null;
  const oldPack = webPack(expected.packSize), pack = webPack(raw.quantity || "");
  if (!oldPack || !pack || oldPack.key !== pack.key) return null;
  const unit = String(raw.product_quantity_unit || "").trim().toLowerCase();
  if ((["g", "kg"].includes(unit) && pack.unit !== "g") || (["ml", "cl", "l"].includes(unit) && pack.unit !== "ml")) return null;
  const nutrients = { ...raw.nutriments } as Record<string, unknown>;
  // Inequalities are not exact values. Do not silently turn '<0.5' into 0.5.
  for (const name of ["energy-kcal", "energy-kj", "proteins", "sugars", "fiber", "salt", "sodium", "saturated-fat", "carbohydrates", "fat"]) {
    if (nutrients[`${name}_modifier`]) delete nutrients[`${name}_100g`];
  }
  return offShelfEvidence({ ...raw, nutriments: nutrients, nutrition_data_per: pack.unit === "g" ? "100g" : "100ml" }, checkedAt);
}
