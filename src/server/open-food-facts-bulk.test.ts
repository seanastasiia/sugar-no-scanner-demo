import { describe, expect, it } from "vitest";
import {
  isLatviaOpenFoodFactsRecord,
  isOpenFoodFactsMarketRecord,
  openFoodFactsBulkRecordToProduct,
  openFoodFactsProductNames
} from "./open-food-facts-bulk";

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

  it("supports the licensed Baltic and Belarus bulk scope without language assumptions", () => {
    expect(
      isOpenFoodFactsMarketRecord({ countries_tags: ["en:lithuania"] }, ["latvia", "lithuania", "belarus"])
    ).toBe(true);
    expect(
      isOpenFoodFactsMarketRecord({ countries: "Беларусь" }, ["latvia", "lithuania", "belarus"])
    ).toBe(true);
    expect(
      isOpenFoodFactsMarketRecord({ countries_tags: ["en:estonia"] }, ["latvia", "lithuania", "belarus"])
    ).toBe(false);
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

  it("retains multilingual product names as exact-source aliases", () => {
    const record = {
      code: "4750050526000",
      product_name: "kaus.siers Dzintars klasiskais",
      product_name_lv: "Kausētais siers klasiskais",
      product_name_en: "Processed Cheese Classic",
      product_name_ru: "Сыр классический",
      product_name_de: "Schmelzkäse klassisch",
      brands: "Dzintars",
      quantity: "200 g",
      countries_tags: ["en:latvia"],
      nutrition_data_per: "100g",
      nutriments: { "energy-kcal_100g": 280, proteins_100g: 12, sugars_100g: 4 }
    };

    expect(openFoodFactsProductNames(record)).toEqual([
      "Kausētais siers klasiskais",
      "Processed Cheese Classic",
      "Сыр классический",
      "kaus.siers Dzintars klasiskais",
      "Schmelzkäse klassisch"
    ]);
    expect(openFoodFactsBulkRecordToProduct(record)).toMatchObject({
      title: "Kausētais siers klasiskais",
      aliases: [
        "Processed Cheese Classic",
        "Сыр классический",
        "kaus.siers Dzintars klasiskais",
        "Schmelzkäse klassisch"
      ]
    });
  });
});
