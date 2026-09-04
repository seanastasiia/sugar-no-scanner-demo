import { describe, expect, it } from "vitest";
import { offParquetProduct, type OffParquetRow } from "./open-food-facts-parquet";

const time = "2026-09-04T13:00:00.000Z";
const sample: OffParquetRow = { code: "3017620422003", brands: "QA", countries_tags: ["en:latvia"], categories: "Chips", lang: "lt",
  product_name: [{ lang: "main", text: "Bulvių traškučiai" }, { lang: "en", text: "Potato chips" }],
  ingredients_text: [{ lang: "main", text: "Bulvės, aliejus, druska" }, { lang: "lt", text: "Bulvės, aliejus, druska" }],
  quantity: "100 g", product_quantity_unit: "g", nutrition_data_per: "100g", nutriments: [
    { name: "energy-kcal", "100g": 400 }, { name: "proteins", "100g": 4 }, { name: "sugars", "100g": 2.700000047683716 },
    { name: "salt", "100g": .5, prepared_100g: 99 }, { name: "saturated-fat", "100g": 1 }
  ] };
describe("official OFF Parquet adaptation", () => {
  it("preserves labelled aliases, original ingredients and unknown fiber", () => {
    const r = offParquetProduct(sample, time);
    expect(r.product).toMatchObject({ source: "open_food_facts", totalSugarG: 2.7, aliases: ["Bulvių traškučiai"],
      shelfEvidence: { source: "open_food_facts", ingredientsLanguage: "lt", ingredientsText: "Bulvės, aliejus, druska", fiberG: null, saltG: .5 } });
  });
  it("uses normalized per-100 values, not the entered serving or prepared values", () => {
    expect(offParquetProduct({ ...sample, nutrition_data_per: "serving" }, time).product?.shelfEvidence?.saltG).toBe(.5);
    expect(offParquetProduct({ ...sample, nutriments: sample.nutriments.map((n) => ({ ...n, "100g": null, prepared_100g: 4 })) }, time).product).toBeNull();
  });
  it("does not silently cast liquids to grams", () => {
    expect(offParquetProduct({ ...sample, quantity: "100 ml", product_quantity_unit: "ml" }, time).product?.nutritionBasis).toBe("100ml");
    expect(offParquetProduct({ ...sample, quantity: "100 ml" }, time).reason).toBe("conflicting_quantity_basis");
    expect(offParquetProduct({ ...sample, quantity: null, product_quantity_unit: null }, time).reason).toBe("unknown_quantity_basis");
  });
  it("rejects wrong check digits, missing brand and source errors", () => {
    expect(offParquetProduct({ ...sample, code: "3017620422004" }, time).reason).toBe("invalid_gtin");
    expect(offParquetProduct({ ...sample, brands: null }, time).reason).toBe("missing_brand");
    expect(offParquetProduct({ ...sample, data_quality_errors_tags: ["en:nutrition-value-over-100"] }, time).reason).toBe("source_quality_flag");
    expect(offParquetProduct({ ...sample, obsolete: true }, time).product).toBeNull();
    expect(offParquetProduct({ ...sample, categories_tags: ["en:pet-foods"] }, time).reason).toBe("not_human_food");
    expect(offParquetProduct({ ...sample, categories: "Cat food" }, time).reason).toBe("not_human_food");
  });
  it("does not fill gaps or choose between contradictory same-language/source values", () => {
    expect(offParquetProduct({ ...sample, ingredients_text: [...sample.ingredients_text, { lang: "lt", text: "Sugar" }] }, time).reason).toBe("ambiguous_language_text");
    expect(offParquetProduct({ ...sample, nutriments: [...sample.nutriments, { name: "salt", "100g": 9 }] }, time).reason).toBe("duplicate_nutrient_conflict");
    expect(offParquetProduct({ ...sample, nutriments: sample.nutriments.filter((n) => n.name !== "sugars") }, time).product).toBeNull();
  });
  it("ignores translated product names when no supported ingredient language exists", () => {
    const r = offParquetProduct({ ...sample, lang: "de", ingredients_text: [{ lang: "main", text: "Kartoffeln, Salz" }] }, time);
    expect(r.product?.shelfEvidence).toMatchObject({ ingredientsLanguage: null, ingredientsText: "Kartoffeln, Salz" });
  });
  it("keeps out-of-market rows outside the import", () => {
    expect(offParquetProduct({ ...sample, countries_tags: ["en:france"] }, time).reason).toBe("outside_markets");
  });
  it("rejects impossible totals even when the source has no quality flag", () => {
    expect(offParquetProduct({ ...sample, nutriments: sample.nutriments.map((n) => n.name === "proteins" ? { ...n, "100g": 101 } : n) }, time).reason).toBe("inconsistent_source_table");
    expect(offParquetProduct({ ...sample, nutriments: [...sample.nutriments, { name: "carbohydrates", "100g": 1 }] }, time).reason).toBe("inconsistent_source_table");
  });
});
