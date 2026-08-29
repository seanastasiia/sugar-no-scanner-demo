import { describe, expect, it } from "vitest";
import {
  buildGroundedWebNutritionProduct,
  extractGroundedNutritionCandidate,
  webNutritionTimeoutMs,
  type GroundedNutritionCandidate
} from "./web-nutrition";

const input = {
  brand: "SELGA",
  name: "Classic biscuits 180 g",
  variant: "Classic",
  packSize: "180 g",
  searchTerms: ["Selga Classic 180g"],
  categoryHint: "snacks" as const
};

const candidate: GroundedNutritionCandidate = {
  exactProductMatch: true,
  matchedBrand: "SELGA",
  matchedProductName: "SELGA Classic biscuits 180 g",
  nutritionBasis: "100g",
  energyKcal: 440,
  proteinG: 7.2,
  totalSugarG: 24,
  confidence: 0.96,
  evidence: "Exact product nutrition table"
};

describe("grounded web nutrition", () => {
  it("never configures a deadline below Google's 10-second minimum", () => {
    expect(webNutritionTimeoutMs()).toBe(12_000);
    expect(webNutritionTimeoutMs("6000")).toBe(10_000);
    expect(webNutritionTimeoutMs("15000")).toBe(15_000);
    expect(webNutritionTimeoutMs("not-a-number")).toBe(12_000);
    expect(webNutritionTimeoutMs("60000")).toBe(30_000);
  });

  it("extracts the cited-search JSON marker without parsing surrounding prose", () => {
    expect(extractGroundedNutritionCandidate(`Source-backed answer.\nNUTRITION_JSON: ${JSON.stringify(candidate)}`)).toEqual(candidate);
    expect(extractGroundedNutritionCandidate("NUTRITION_JSON: {not-json}")).toBeNull();
  });

  it("builds a complete Sugar.no fit only from an exact cited per-100 result", () => {
    const result = buildGroundedWebNutritionProduct(
      input,
      candidate,
      [{ title: "Manufacturer nutrition", url: "https://example.com/selga-classic" }],
      "2026-08-25T00:00:00.000Z"
    );

    expect(result?.product).toMatchObject({
      id: expect.stringMatching(/^web:/),
      ratingBasis: "web_search_reference",
      ratingStatus: "complete",
      ratingSignalCount: 2,
      nutrientsPer100g: { proteinG: 7.2, totalSugarG: 24 }
    });
    expect(result?.product.sources[0]).toMatchObject({
      url: "https://example.com/selga-classic",
      status: "secondary"
    });
  });

  it("fails closed for an uncited, uncertain or non-exact result", () => {
    expect(buildGroundedWebNutritionProduct(input, candidate, [])).toBeNull();
    expect(
      buildGroundedWebNutritionProduct(input, { ...candidate, exactProductMatch: false }, [
        { title: "Source", url: "https://example.com/product" }
      ])
    ).toBeNull();
    expect(
      buildGroundedWebNutritionProduct(input, { ...candidate, confidence: 0.89 }, [
        { title: "Source", url: "https://example.com/product" }
      ])
    ).toBeNull();
  });
});
