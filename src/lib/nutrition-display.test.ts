import { describe, expect, it } from "vitest";
import { compactNutritionLabel } from "@/lib/nutrition-display";

describe("compactNutritionLabel", () => {
  it("shows carbohydrates in parentheses after sugar", () => {
    expect(compactNutritionLabel({ totalSugarG: 4.7, carbohydrateG: 5 })).toBe(
      "Sugar 4.7g (Carbs 5g)"
    );
  });

  it("does not invent carbohydrates when they are unavailable", () => {
    expect(compactNutritionLabel({ totalSugarG: 4.7, carbohydrateG: null })).toBe("Sugar 4.7g");
  });
});
