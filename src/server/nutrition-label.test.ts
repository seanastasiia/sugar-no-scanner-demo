import { describe, expect, it } from "vitest";
import { isTrustedNutritionLabelRead, nutritionLabelToScoredProduct } from "./nutrition-label";

const identity = {
  brand: "Sproud",
  name: "Barista Low Sugar High in Protein Drink Made from Peas 1L",
  variant: null,
  packSize: "1 L",
  category: "plant drink",
  matchKind: "visual_only" as const
};

const read = {
  basis: "100ml" as const,
  energyKcal: 40,
  proteinG: 2.1,
  totalSugarG: 1.8,
  confidence: 0.96,
  observedText: "Nutrition per 100 ml: Energy 170 kJ / 40 kcal; Protein 2,1 g; of which sugars 1,8 g"
};

describe("nutrition-label fallback", () => {
  it("accepts a high-confidence per-100 label whose values appear beside their fields", () => {
    expect(isTrustedNutritionLabelRead(read)).toBe(true);
    const product = nutritionLabelToScoredProduct(identity, read);
    expect(product).toMatchObject({
      ratingBasis: "package_label_reference",
      ratingSignalCount: 2,
      nutrientsPer100g: { proteinG: 2.1, totalSugarG: 1.8 }
    });
    expect(product?.sources[0]).toMatchObject({ label: "Nutrition label in this scan", status: "verified" });
  });

  it("rejects serving-only, low-confidence and text/value mismatches", () => {
    expect(isTrustedNutritionLabelRead({ ...read, basis: "unknown" })).toBe(false);
    expect(isTrustedNutritionLabelRead({ ...read, confidence: 0.89 })).toBe(false);
    expect(isTrustedNutritionLabelRead({ ...read, proteinG: 9.9 })).toBe(false);
    expect(isTrustedNutritionLabelRead({ ...read, observedText: "Per serving: Protein 2.1 g; sugars 1.8 g; 40 kcal" })).toBe(false);
  });
});
