import { describe, expect, it } from "vitest";
import { compareFairCohorts, rankSimilarProducts, scoreBarboraProduct, scoreCatalog } from "./scoring";
import type { ProductRecord, RatingSignal, ScoredProduct } from "./types";

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

  it("scores a product with any two source-backed catalog signals", () => {
    const [scored] = scoreCatalog([product("pending", 25, null, 3)]);
    expect(scored.matchScore).toBe(50);
    expect(scored.matchReason).toBe("partial_nutrition");
    expect(scored.ratingStatus).toBe("partial_overall");
    expect(scored.ratingSignalMask).toEqual(["protein", "inverseSugar"]);
    expect(scored.criterionScores).toEqual({ protein: 100, fiber: null, inverseSugar: 0 });
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
    expect(withIncomplete[2].matchScore).toBe(50);
    expect(withIncomplete[2].criterionScores).toEqual({ protein: 100, fiber: null, inverseSugar: 0 });
  });

  it.each([
    ["protein+fiber", 20, 5, null, ["protein", "fiber"], 100],
    ["protein+sugar", 20, null, 5, ["protein", "inverseSugar"], 50],
    ["fiber+sugar", null, 5, 5, ["fiber", "inverseSugar"], 50]
  ] as const)("builds a partial overall result for %s", (_label, protein, fiber, sugar, mask, score) => {
    const [scored] = scoreCatalog([product("two-signals", protein, fiber, sugar)]);
    expect(scored.matchScore).toBe(score);
    expect(scored.ratingStatus).toBe("partial_overall");
    expect(scored.ratingSignalCount).toBe(2);
    expect(scored.ratingSignalMask).toEqual(mask);
  });

  it.each([
    ["protein", 20, null, null, "protein"],
    ["fiber", null, 5, null, "fiber"],
    ["sugar", null, null, 5, "inverseSugar"]
  ] as const)("preserves a %s-only signal without inventing an overall fit", (_label, protein, fiber, sugar, signal) => {
    const [scored] = scoreCatalog([product("one-signal", protein, fiber, sugar)]);
    expect(scored.matchScore).toBeNull();
    expect(scored.matchReason).toBe("limited_nutrition");
    expect(scored.ratingStatus).toBe("limited_signal");
    expect(scored.ratingSignalMask).toEqual([signal]);
    expect(scored.criterionScores?.[signal]).toBeTypeOf("number");
  });

  it("keeps a zero-signal product as identity only", () => {
    const [scored] = scoreCatalog([product("identity", null, null, null)]);
    expect(scored.matchScore).toBeNull();
    expect(scored.ratingStatus).toBe("identity_only");
    expect(scored.ratingSignalCount).toBe(0);
    expect(scored.ratingSignalMask).toEqual([]);
    expect(scored.criterionScores).toBeNull();
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

  it.each([
    ["protein+fiber", 25, 8, null, ["protein", "fiber"]],
    ["protein+sugar", 25, null, 2, ["protein", "inverseSugar"]],
    ["fiber+sugar", null, 8, 2, ["fiber", "inverseSugar"]]
  ] as const)("supports the Barbora %s partial permutation", (_label, protein, fiber, sugar, mask) => {
    const scored = scoreBarboraProduct({
      ...product("barbora-two", protein, fiber, sugar, "other"),
      energyKcalPer100: 300,
      nutritionBasis: "100g"
    });
    expect(scored.matchScore).not.toBeNull();
    expect(scored.ratingBasis).toBe("barbora_reference_partial");
    expect(scored.ratingStatus).toBe("partial_overall");
    expect(scored.ratingSignalMask).toEqual(mask);
  });

  it.each([
    ["protein", 25, null, null, 300, "protein"],
    ["fiber", null, 8, null, 300, "fiber"],
    ["sugar", null, null, 2, null, "inverseSugar"]
  ] as const)("preserves the Barbora %s-only criterion but no overall fit", (_label, protein, fiber, sugar, energy, signal) => {
    const scored = scoreBarboraProduct({
      ...product("barbora-one", protein, fiber, sugar, "other"),
      energyKcalPer100: energy,
      nutritionBasis: "100g"
    });
    expect(scored.matchScore).toBeNull();
    expect(scored.ratingStatus).toBe("limited_signal");
    expect(scored.ratingSignalMask).toEqual([signal]);
    expect(scored.criterionScores?.[signal]).toBeTypeOf("number");
  });
});

function comparable(
  id: string,
  category: string,
  basis: "100g" | "100ml",
  ratingBasis: ScoredProduct["ratingBasis"],
  criteria: Record<RatingSignal, number | null>
): ScoredProduct {
  const mask = (Object.entries(criteria) as Array<[RatingSignal, number | null]>)
    .filter(([, value]) => value !== null)
    .map(([signal]) => signal);
  return {
    ...product(id, 1, 1, 1, "other"),
    category,
    nutritionBasis: basis,
    matchScore: mask.length >= 2 ? 50 : null,
    matchReason: mask.length === 3 ? "complete" : mask.length === 2 ? "partial_nutrition" : "limited_nutrition",
    ratingBasis,
    ratingStatus: mask.length === 3 ? "complete" : mask.length === 2 ? "partial_overall" : "limited_signal",
    ratingSignalCount: mask.length,
    ratingSignalMask: mask,
    criterionScores: criteria
  };
}

describe("compareFairCohorts", () => {
  const high = comparable("high", "protein bar", "100g", "barbora_reference", {
    protein: 90,
    fiber: 80,
    inverseSugar: 70
  });
  const low = comparable("low", "protein bar", "100g", "barbora_reference_partial", {
    protein: 55,
    fiber: 55,
    inverseSugar: null
  });

  it("uses the common two-signal intersection and is stable across detection order", () => {
    const forward = compareFairCohorts([high, low]);
    const reverse = compareFairCohorts([low, high]);
    expect(forward).toEqual(reverse);
    expect(forward.cohorts[0]).toMatchObject({
      productIds: ["high", "low"],
      signalMask: ["protein", "fiber"],
      winnerId: "high"
    });
  });

  it("does not name a winner when the common-signal score gap is under five", () => {
    const near = comparable("near", "protein bar", "100g", "barbora_reference_partial", {
      protein: 87,
      fiber: 77,
      inverseSugar: null
    });
    expect(compareFairCohorts([high, near]).cohorts[0].winnerId).toBeNull();
  });

  it.each([
    ["category", { category: "drink" }],
    ["nutrition basis", { nutritionBasis: "100ml" as const }],
    ["scoring method", { ratingBasis: "catalog_percentile_partial" as const }]
  ])("never mixes products with a different %s", (_label, override) => {
    expect(compareFairCohorts([high, { ...low, ...override }]).cohorts).toEqual([]);
  });

  it("requires at least two common signals", () => {
    const sugarFiber = comparable("sugar-fiber", "protein bar", "100g", "barbora_reference_partial", {
      protein: null,
      fiber: 55,
      inverseSugar: 55
    });
    expect(compareFairCohorts([low, sugarFiber]).cohorts).toEqual([]);
  });

  it("ignores an identity-only product with missing rating metadata", () => {
    const identityOnly = {
      ...comparable("identity", "protein bar", "100g", "barbora_reference_partial", {
        protein: null,
        fiber: null,
        inverseSugar: null
      }),
      ratingBasis: null as unknown as ScoredProduct["ratingBasis"],
      ratingStatus: "identity_only" as const,
      ratingSignalCount: 0,
      ratingSignalMask: [],
      criterionScores: null
    };

    expect(() => compareFairCohorts([high, identityOnly])).not.toThrow();
    expect(compareFairCohorts([high, identityOnly])).toEqual({ cohorts: [], winnerIds: [] });
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
