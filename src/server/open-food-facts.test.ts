import { describe, expect, it } from "vitest";
import {
  openFoodFactsToScoredProduct,
  rankOpenFoodFactsCandidates,
  type OpenFoodFactsProduct
} from "./open-food-facts";

const input = {
  brand: "NICK'S",
  name: "Soft Toffee protein bar 50 g",
  variant: "Soft Toffee",
  packSize: "50 g",
  searchTerms: ["Nicks Soft Toffee protein bar"]
};

function product(overrides: Partial<OpenFoodFactsProduct> = {}): OpenFoodFactsProduct {
  return {
    code: "7350104401012",
    product_name: "Soft Toffee Protein Bar",
    brands: ["NICK'S"],
    quantity: "50 g",
    nutrition_data_per: "100g",
    nutriments: {
      "energy-kcal_100g": 360,
      proteins_100g: 30,
      sugars_100g: 3.2
    },
    ...overrides
  };
}

describe("Open Food Facts matching", () => {
  it("accepts a matching brand, variant and pack size with complete nutrition", () => {
    const ranked = rankOpenFoodFactsCandidates(input, [product()]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].confidence).toBeGreaterThanOrEqual(0.84);
  });

  it("rejects a different variant even when brand and pack size match", () => {
    const ranked = rankOpenFoodFactsCandidates(
      { ...input, brand: "Coca-Cola", name: "Original Taste 330 ml", variant: "Original Taste", packSize: "330 ml" },
      [
        product({
          code: "5449000214799",
          product_name: "Coke Zero",
          brands: ["Coca-Cola"],
          quantity: "330 ml"
        })
      ]
    );
    expect(ranked).toEqual([]);
  });

  it("rejects a pack-size mismatch instead of borrowing another SKU's nutrition", () => {
    expect(rankOpenFoodFactsCandidates(input, [product({ quantity: "200 g" })])).toEqual([]);
  });

  it("turns source-backed protein and sugar into a two-factor reference fit", () => {
    const scored = openFoodFactsToScoredProduct(product());
    expect(scored?.id).toBe("off:7350104401012");
    expect(scored?.ratingBasis).toBe("open_food_facts_reference");
    expect(scored?.ratingSignalCount).toBe(2);
    expect(scored?.nutrientsPer100g).toMatchObject({ proteinG: 30, totalSugarG: 3.2 });
    expect(scored?.sources[0].label).toBe("Open Food Facts product record");
  });
});
