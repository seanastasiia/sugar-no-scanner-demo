import { describe, expect, it } from "vitest";
import { rankSimilarProducts, scoreBarboraProduct, scoreCatalog } from "./scoring";
import type { ProductRecord } from "./types";

function product(
  id: string,
  proteinG: number | null,
  fiberG: number | null,
  totalSugarG: number | null,
  format: ProductRecord["format"] = "bar"
): ProductRecord {
  return {
    id,
    retailerProductId: id,
    brand: "Test",
    name: `Product ${id}`,
    shortName: id,
    aliases: [],
    format,
    packSizeG: 50,
    gtin: null,
    nutrientsPer100g: { proteinG, fiberG, totalSugarG },
    noAddedSugarClaim: false,
    imageUrl: null,
    retailerUrl: `https://example.com/${id}`,
    sources: [],
    isGolden: false,
    accent: "coral"
  };
}

describe("scoreCatalog", () => {
  it("rewards more protein, more fiber and less total sugar equally", () => {
    const scored = scoreCatalog([
      product("top", 30, 12, 2),
      product("middle", 20, 6, 8),
      product("bottom", 10, 2, 20)
    ]);

    expect(scored.find((item) => item.id === "top")?.matchScore).toBe(100);
    expect(scored.find((item) => item.id === "middle")?.matchScore).toBe(50);
    expect(scored.find((item) => item.id === "bottom")?.matchScore).toBe(0);
  });

  it("does not score products with incomplete nutrition", () => {
    const [scored] = scoreCatalog([product("pending", 25, null, 3)]);
    expect(scored.matchScore).toBeNull();
    expect(scored.matchReason).toBe("missing_nutrition");
  });

  it("does not include the no-added-sugar claim in the score", () => {
    const first = product("first", 20, 5, 5);
    const second = { ...product("second", 20, 5, 5), noAddedSugarClaim: true };
    const scored = scoreCatalog([first, second]);
    expect(scored[0].matchScore).toBe(scored[1].matchScore);
  });

  it("uses every available field in the category population even when another field is missing", () => {
    const completeOnly = scoreCatalog([
      product("complete-low", 10, 5, 5),
      product("complete-high", 20, 10, 2)
    ]);
    const withIncomplete = scoreCatalog([
      product("complete-low", 10, 5, 5),
      product("complete-high", 20, 10, 2),
      product("protein-only", 40, null, 8)
    ]);
    expect(withIncomplete[1].criterionScores?.protein).toBeLessThan(
      completeOnly[1].criterionScores?.protein ?? 0
    );
    expect(withIncomplete[2].matchScore).toBeNull();
  });
});

describe("scoreBarboraProduct", () => {
  it("builds a two-signal quick view when the exact page omits fiber", () => {
    const scored = scoreBarboraProduct({
      ...product("barbora-food", 22, null, 14, "other"),
      energyKcalPer100: 594,
      nutritionBasis: "100g"
    });

    expect(scored.matchScore).toBe(38);
    expect(scored.matchReason).toBe("partial_nutrition");
    expect(scored.ratingBasis).toBe("barbora_reference_partial");
    expect(scored.ratingSignalCount).toBe(2);
    expect(scored.criterionScores).toEqual({ protein: 55, fiber: null, inverseSugar: 20 });
  });

  it("builds a full three-signal reference view when fiber is listed", () => {
    const scored = scoreBarboraProduct({
      ...product("barbora-complete", 25, 8, 2, "other"),
      energyKcalPer100: 300,
      nutritionBasis: "100g"
    });

    expect(scored.matchScore).toBe(100);
    expect(scored.matchReason).toBe("complete");
    expect(scored.ratingBasis).toBe("barbora_reference");
    expect(scored.ratingSignalCount).toBe(3);
  });

  it("uses the lower EU low-sugar threshold for liquids", () => {
    const solid = scoreBarboraProduct({
      ...product("solid", 4, null, 4, "other"),
      energyKcalPer100: 80,
      nutritionBasis: "100g"
    });
    const liquid = scoreBarboraProduct({
      ...product("liquid", 4, null, 4, "other"),
      energyKcalPer100: 80,
      nutritionBasis: "100ml"
    });

    expect(solid.criterionScores?.inverseSugar).toBe(100);
    expect(liquid.criterionScores?.inverseSugar).toBe(55);
  });

  it("does not invent a rating without protein, sugar and energy", () => {
    const scored = scoreBarboraProduct({
      ...product("non-food", null, null, null, "other"),
      energyKcalPer100: null,
      nutritionBasis: "100g"
    });

    expect(scored.matchScore).toBeNull();
    expect(scored.matchReason).toBe("missing_nutrition");
  });
});

describe("rankSimilarProducts", () => {
  it("ranks same-format products before higher-scoring different formats", () => {
    const scored = scoreCatalog([
      product("current", 20, 5, 8, "bar"),
      product("same-format", 21, 6, 7, "bar"),
      product("different", 40, 20, 0, "cookie")
    ]);
    const ranked = rankSimilarProducts(scored[0], scored);
    expect(ranked.map((item) => item.id)).toEqual(["same-format", "different"]);
  });
});
