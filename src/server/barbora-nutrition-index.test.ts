import { describe, expect, it } from "vitest";
import {
  getIndexedBarboraProductWithAlternatives,
  indexedBarboraProductToScoredProduct,
  listIndexedBarboraNutrition
} from "./barbora-nutrition-index";
import { isExactBarboraMatch, rankIndexedBarboraCandidates } from "./barbora-catalog";

describe("broad Barbora nutrition snapshot", () => {
  it("ships thousands of current automatic-fit records instead of stopping at the 40 curated snacks", () => {
    const products = listIndexedBarboraNutrition();
    expect(products).toHaveLength(7_433);
    expect(new Set(products.map((product) => product.slug)).size).toBe(products.length);
    expect(products.every((product) => !product.isAdult)).toBe(true);
  });

  it("creates a complete source-backed reference fit and normalizes a liquid pack", () => {
    const product = indexedBarboraProductToScoredProduct({
      slug: "example-drink-0-5-l",
      title: "Example drink 0,5l",
      brand: "EXAMPLE",
      category: "Dzērieni",
      packSize: "0,5l",
      nutritionBasis: "100ml",
      energyKcal: 40,
      proteinG: 2.1,
      totalSugarG: 1.8,
      imageUrl: null,
      isAdult: false,
      checkedAt: "2026-08-25T00:00:00.000Z"
    });

    expect(product).toMatchObject({
      id: "barbora:example-drink-0-5-l",
      packSizeG: 500,
      nutritionBasis: "100ml",
      ratingBasis: "barbora_reference",
      ratingStatus: "complete",
      ratingSignalCount: 2,
      ratingSignalMask: ["protein", "inverseSugar"]
    });
    expect(product.matchScore).toBeTypeOf("number");
    expect(product.sources[0]?.fields).toEqual(["identity", "protein", "totalSugar", "retailerUrl"]);
  });

  it("does not rate adult products even when the source exposes nutrition", () => {
    const product = indexedBarboraProductToScoredProduct({
      slug: "adult-example",
      title: "Adult example",
      brand: "EXAMPLE",
      category: "Adult",
      packSize: "500ml",
      nutritionBasis: "100ml",
      energyKcal: 50,
      proteinG: 0,
      totalSugarG: 5,
      imageUrl: null,
      isAdult: true,
      checkedAt: "2026-08-25T00:00:00.000Z"
    });

    expect(product).toMatchObject({
      matchScore: null,
      ratingStatus: "identity_only",
      ratingSignalCount: 0
    });
  });

  it("keeps broad alternatives inside the same source category and basis", () => {
    const result = getIndexedBarboraProductWithAlternatives("3-graudu-parslas-extra-line-400-g", 4);
    expect(result?.product.id).toBe("barbora:3-graudu-parslas-extra-line-400-g");
    expect(result?.alternatives.length).toBeGreaterThan(0);
    expect(
      result?.alternatives.every(
        (candidate) =>
          candidate.category === result.product.category &&
          candidate.nutritionBasis === result.product.nutritionBasis &&
          candidate.id !== result.product.id
      )
    ).toBe(true);
  });

  it.each([
    ["HELLMANNS", "Original Mayonnaise 420ml", "420ml", "majoneze-hellmanns-original-76-proc-405-ml"],
    ["SPILVA", "Majoneze Rosola Klasika 250g", "250g", "majoneze-rosola-spilva-250-g"],
    ["SPILVA", "Siera majoneze 250g", "250g", "majoneze-siera-spilva-250-g"],
    ["SPILVA", "Originala majonēze stāvpaka 250ml", "250ml", "majoneze-spilva-originala-stavpaka-250-ml"]
  ])("links a previously ambiguous real-shelf identity to one exact SKU", (brand, name, packSize, expectedSlug) => {
    const candidates = rankIndexedBarboraCandidates({
      brand,
      name,
      variant: "",
      packSize,
      searchTerms: [name]
    });
    expect(candidates[0]?.slug).toBe(expectedSlug);
    expect(isExactBarboraMatch(candidates[0]?.score || 0, candidates[1]?.score || 0)).toBe(true);
  });
});
