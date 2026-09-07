import { describe, expect, it } from "vitest";
import { exactOffEvidence } from "./off-exact-evidence";
const expected = { code: "4006381333931", brand: "QA", title: "QA Chips", aliases: ["QA Traškučiai"], packSize: "100 g" };
const raw = { code: expected.code, brands: "QA", product_name: "QA Traškučiai", quantity: "100 g", categories: "Chips", lang: "lt", ingredients_text: "Bulvės, druska", nutriments: { proteins_100g: 4, sugars_100g: 2, salt_100g: .5 } };
const time = "2026-09-04T13:00:00.000Z";
describe("exact OFF follow-up identity", () => {
  it("accepts only a source-confirmed name alias and preserves unknown nutrients", () => {
    expect(exactOffEvidence(raw, expected, time)).toMatchObject({ ingredientsLanguage: "lt", nutritionBasis: "100g", fiberG: null, saltG: .5 });
  });
  it.each([{ quantity: "120 g" }, { brands: "Other" }, { product_name: "QA Spicy chips" }, { code: "4006381333932" }, { product_quantity_unit: " ML " }, { data_quality_errors_tags: ["en:error"] }])("rejects source identity/quality change %j", (change) => {
    expect(exactOffEvidence({ ...raw, ...change }, expected, time)).toBeNull();
  });
  it("keeps nutrient inequalities unknown", () => {
    expect(exactOffEvidence({ ...raw, nutriments: { ...raw.nutriments, salt_modifier: "<" } }, expected, time)?.saltG).toBeNull();
  });
});
