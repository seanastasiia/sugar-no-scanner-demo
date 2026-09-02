import { describe, expect, it } from "vitest";
import { compactNutritionLabel } from "@/lib/nutrition-display";

describe("compactNutritionLabel", () => {
  it("shows the protein and sugar used by Fit plus source-backed carbohydrates", () => {
    expect(compactNutritionLabel({ proteinG: 3.2, totalSugarG: 4.7, carbohydrateG: 5 })).toBe(
      "Protein 3.2g · Sugar 4.7g · Carbs 5g"
    );
  });

  it("does not invent carbohydrates when they are unavailable", () => {
    expect(compactNutritionLabel({ proteinG: 3.2, totalSugarG: 4.7, carbohydrateG: null })).toBe(
      "Protein 3.2g · Sugar 4.7g"
    );
  });

  it("does not present a complete Fit label when protein is unavailable", () => {
    expect(compactNutritionLabel({ proteinG: null, totalSugarG: 4.7, carbohydrateG: 5 })).toBeNull();
  });
});
