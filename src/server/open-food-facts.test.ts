import { describe, expect, it } from "vitest";
import {
  openFoodFactsToScoredProduct,
  rankOpenFoodFactsCandidates,
  resolveOpenFoodFactsProduct,
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
      sugars_100g: 3.2,
      carbohydrates_100g: 18
    },
    ...overrides
  };
}

describe("Open Food Facts matching", () => {
  it("resolves the bundled Pilos milk record from the detailed visual search query", async () => {
    const resolved = await resolveOpenFoodFactsProduct({
      brand: "Pilos",
      name: "Pilos",
      variant: "",
      packSize: "1L",
      searchTerms: ["Pilos Milk 3.2% 1L"]
    });

    expect(resolved).toMatchObject({
      confidence: 1,
      product: {
        id: "off:20059750",
        brand: "Pilos",
        nutrientsPer100g: { proteinG: 3.2, totalSugarG: 4.7 }
      }
    });
  });

  it("accepts a matching brand, variant and pack size with complete nutrition", () => {
    const ranked = rankOpenFoodFactsCandidates(input, [product()]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].confidence).toBeGreaterThanOrEqual(0.84);
  });

  it("matches the English camera identity against a Latvian product with source aliases", () => {
    const ranked = rankOpenFoodFactsCandidates(
      {
        brand: "Dzintars",
        name: "Processed Cheese Classic 200 g",
        variant: "Classic",
        packSize: "200 g",
        searchTerms: ["Dzintars Processed Cheese Classic"]
      },
      [
        product({
          code: "4750050526000",
          product_name: "Kausētais siers klasiskais",
          product_name_en: "Processed Cheese Classic",
          product_name_ru: "Сыр классический",
          brands: ["Dzintars"],
          quantity: "200 g"
        })
      ]
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0].confidence).toBeGreaterThanOrEqual(0.84);
  });

  it("accepts an exact OFF identity without package size for per-100 nutrition", () => {
    const ranked = rankOpenFoodFactsCandidates(
      {
        brand: "NICK'S",
        name: "Soft Toffee protein bar",
        variant: "Soft Toffee",
        packSize: "",
        searchTerms: ["Nicks Soft Toffee protein bar"]
      },
      [product()]
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0].confidence).toBeGreaterThanOrEqual(0.84);
  });

  it("keeps identical OFF products with different package sizes ambiguous when size is missing", () => {
    const ranked = rankOpenFoodFactsCandidates(
      {
        brand: "NICK'S",
        name: "Soft Toffee protein bar",
        variant: "Soft Toffee",
        packSize: "",
        searchTerms: []
      },
      [
        product({ code: "small", quantity: "50 g" }),
        product({ code: "large", quantity: "75 g" })
      ]
    );

    expect(ranked).toHaveLength(2);
    expect(ranked[0].confidence - ranked[1].confidence).toBeLessThan(0.08);
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

  it("rejects a different stated dairy percentage even when translated product names match", () => {
    const ranked = rankOpenFoodFactsCandidates(
      {
        brand: "Pilos",
        name: "Pilos",
        variant: "",
        packSize: "1L",
        searchTerms: ["Pilos Milk 3.2% 1L"]
      },
      [product({ code: "4056489660453", product_name: "Piens 2%", brands: ["Pilos"], quantity: "1L" })]
    );

    expect(ranked).toEqual([]);
  });

  it("matches decimal and Russian pack units without changing the SKU quantity", () => {
    const ranked = rankOpenFoodFactsCandidates(
      { ...input, packSize: "0,05 кг" },
      [product({ quantity: "50 g" })]
    );
    expect(ranked).toHaveLength(1);
  });

  it("does not treat a generic label as an exact flavored OFF variant", () => {
    const ranked = rankOpenFoodFactsCandidates(
      {
        brand: "Actimel",
        name: "Immune Support 100g",
        variant: "",
        packSize: "100g",
        searchTerms: []
      },
      [product({ product_name: "Immune Support Blueberry 100g", brands: ["Actimel"], quantity: "100g" })]
    );
    expect(ranked).toEqual([]);
  });

  it("turns source-backed protein and sugar into a two-factor reference fit", () => {
    const scored = openFoodFactsToScoredProduct(product());
    expect(scored?.id).toBe("off:7350104401012");
    expect(scored?.ratingBasis).toBe("open_food_facts_reference");
    expect(scored?.ratingSignalCount).toBe(2);
    expect(scored?.nutrientsPer100g).toMatchObject({ proteinG: 30, totalSugarG: 3.2, carbohydrateG: 18 });
    expect(scored?.sources[0].fields).toContain("carbohydrate");
    expect(scored?.sources[0].label).toBe("Open Food Facts product record");
  });

  it("keeps multilingual Open Food Facts names on the scored product", () => {
    const scored = openFoodFactsToScoredProduct(product({
      product_name: "Kausētais siers klasiskais",
      product_name_en: "Processed Cheese Classic",
      product_name_ru: "Сыр классический"
    }));

    expect(scored?.name).toBe("Processed Cheese Classic");
    expect(scored?.aliases).toEqual([
      "Сыр классический",
      "Kausētais siers klasiskais"
    ]);
  });
});
