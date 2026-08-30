import { describe, expect, it } from "vitest";
import { isLatviaOpenFoodFactsRecord, openFoodFactsBulkRecordToProduct } from "./open-food-facts-bulk";

describe("Open Food Facts bulk normalization", () => {
  it("keeps a Latvia-tagged product with complete per-100 nutrition", () => {
    const record = {
      code: "7350104401012",
      product_name: "Soft Toffee Protein Bar",
      brands: "NICK'S",
      quantity: "50 g",
      countries_tags: ["en:latvia"],
      nutrition_data_per: "100g",
      nutriments: { "energy-kcal_100g": 360, proteins_100g: 30, sugars_100g: 3.2, carbohydrates_100g: 18 }
    };
    expect(isLatviaOpenFoodFactsRecord(record)).toBe(true);
    expect(openFoodFactsBulkRecordToProduct(record, "2026-08-26T00:00:00.000Z")).toMatchObject({
      source: "open_food_facts",
      gtin: "7350104401012",
      proteinG: 30,
      totalSugarG: 3.2,
      carbohydrateG: 18
    });
  });

  it("rejects missing sugar and invalid barcodes", () => {
    expect(openFoodFactsBulkRecordToProduct({ code: "bad", product_name: "A", nutriments: {} })).toBeNull();
    expect(
      openFoodFactsBulkRecordToProduct({
        code: "7350104401012",
        product_name: "A",
        nutriments: { "energy-kcal_100g": 100, proteins_100g: 1 }
      })
    ).toBeNull();
  });
});
