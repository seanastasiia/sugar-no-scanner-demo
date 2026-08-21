import { describe, expect, it } from "vitest";
import type { BarboraPageProduct } from "./barbora-catalog";
import { barboraPageToScoredProduct } from "./barbora-product-rating";

function page(overrides: Partial<BarboraPageProduct> = {}): BarboraPageProduct {
  return {
    title: "Zemesrieksti ESTRELLA ar medu 140g",
    brand_name: "ESTRELLA",
    price: 1.99,
    comparative_unit: "kg",
    comparative_unit_price: 14.21,
    image: "https://cdn.example/product.png",
    Url: "zemesrieksti-estrella-ar-medu-140-g",
    status: "active",
    nutrients: [
      { Name: "Enerģētiskā vērtība", Amounts: [{ Amount: 594, UnitName: "Kcal" }] },
      { Name: "Cukuri", Amounts: [{ Amount: 14, UnitName: "g" }] },
      { Name: "Olbaltumvielas", Amounts: [{ Amount: 22, UnitName: "g" }] }
    ],
    attributes: {
      list: [{ id: "Neto daudzums (g/ml)", value: "140", group: 1 }]
    },
    ...overrides
  };
}

describe("Barbora on-demand product rating", () => {
  it("converts exact retailer nutrition into a traceable two-signal result", () => {
    const product = barboraPageToScoredProduct(page(), "2026-08-21T12:00:00.000Z");

    expect(product).toMatchObject({
      id: "barbora:zemesrieksti-estrella-ar-medu-140-g",
      nutritionBasis: "100g",
      energyKcalPer100: 594,
      packSizeG: 140,
      matchScore: 38,
      matchReason: "partial_nutrition",
      ratingSignalCount: 2,
      nutrientsPer100g: { proteinG: 22, fiberG: null, totalSugarG: 14 }
    });
    expect(product.sources[0].fields).toEqual(["identity", "retailerUrl", "protein", "totalSugar"]);
  });

  it("uses per-100-ml thresholds for a liquid", () => {
    const product = barboraPageToScoredProduct(
      page({
        title: "Dzēriens 330ml",
        comparative_unit: "l",
        nutrients: [
          { Name: "Enerģētiskā vērtība", Amounts: [{ Amount: 80, UnitName: "Kcal" }] },
          { Name: "Cukuri", Amounts: [{ Amount: 4, UnitName: "g" }] },
          { Name: "Olbaltumvielas", Amounts: [{ Amount: 4, UnitName: "g" }] }
        ]
      })
    );

    expect(product.nutritionBasis).toBe("100ml");
    expect(product.criterionScores?.inverseSugar).toBe(55);
  });

  it("keeps pages without nutrition and adult products unrated", () => {
    expect(barboraPageToScoredProduct(page({ nutrients: [] })).matchScore).toBeNull();
    expect(barboraPageToScoredProduct(page({ is_adult: true })).matchScore).toBeNull();
  });
});
