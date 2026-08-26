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
  it("weights protein and inverse total sugar equally", () => {
    const scored = scoreCatalog([
      product("top", 30, null, 2),
      product("middle", 20, 99, 8),
      product("bottom", 10, 1, 20)
    ]);
    expect(scored.map((item) => item.matchScore)).toEqual([100, 50, 0]);
    expect(scored.every((item) => item.ratingStatus === "complete")).toBe(true);
    expect(scored.every((item) => item.ratingSignalCount === 2)).toBe(true);
  });

  it("does not let fiber change the score", () => {
    const scored = scoreCatalog([
      product("no-fiber", 20, null, 5),
      product("high-fiber", 20, 50, 5)
    ]);
    expect(scored[0].matchScore).toBe(scored[1].matchScore);
    expect(scored[0].criterionScores).toEqual({ protein: 50, inverseSugar: 50 });
    expect(scored[1].criterionScores).toEqual({ protein: 50, inverseSugar: 50 });
  });

  it("does not include the no-added-sugar claim in the score", () => {
    const first = product("first", 20, null, 5);
    const second = { ...product("second", 20, null, 5), noAddedSugarClaim: true };
    const scored = scoreCatalog([first, second]);
    expect(scored[0].matchScore).toBe(scored[1].matchScore);
  });

  it.each([
    ["protein", 20, null, "protein"],
    ["sugar", null, 5, "inverseSugar"]
  ] as const)("keeps a %s-only signal neutral", (_label, protein, sugar, signal) => {
    const [scored] = scoreCatalog([product("limited", protein, 100, sugar)]);
    expect(scored.matchScore).toBeNull();
    expect(scored.matchReason).toBe("limited_nutrition");
    expect(scored.ratingStatus).toBe("limited_signal");
    expect(scored.ratingSignalMask).toEqual([signal]);
  });

  it("treats fiber-only data as identity-only", () => {
    const [scored] = scoreCatalog([product("identity", null, 8, null)]);
    expect(scored.matchScore).toBeNull();
    expect(scored.ratingStatus).toBe("identity_only");
    expect(scored.ratingSignalCount).toBe(0);
    expect(scored.criterionScores).toBeNull();
  });
});

describe("scoreBarboraProduct", () => {
  it("builds a complete two-factor fit without fiber", () => {
    const scored = scoreBarboraProduct({
      ...product("barbora-food", 22, null, 14, "other"),
      energyKcalPer100: 594,
      nutritionBasis: "100g"
    });
    expect(scored.matchScore).toBe(38);
    expect(scored.matchReason).toBe("complete");
    expect(scored.ratingBasis).toBe("barbora_reference");
    expect(scored.ratingStatus).toBe("complete");
    expect(scored.ratingSignalCount).toBe(2);
    expect(scored.criterionScores).toEqual({ protein: 55, inverseSugar: 20 });
  });

  it("produces the same result when fiber is listed", () => {
    const withoutFiber = scoreBarboraProduct({
      ...product("without", 25, null, 2, "other"),
      energyKcalPer100: 300,
      nutritionBasis: "100g"
    });
    const withFiber = scoreBarboraProduct({
      ...product("with", 25, 25, 2, "other"),
      energyKcalPer100: 300,
      nutritionBasis: "100g"
    });
    expect(withFiber.matchScore).toBe(withoutFiber.matchScore);
    expect(withFiber.criterionScores).toEqual(withoutFiber.criterionScores);
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

  it("does not invent an overall fit without both protein and sugar", () => {
    const scored = scoreBarboraProduct({
      ...product("sugar-only", null, 12, 2, "other"),
      energyKcalPer100: 300,
      nutritionBasis: "100g"
    });
    expect(scored.matchScore).toBeNull();
    expect(scored.ratingStatus).toBe("limited_signal");
    expect(scored.ratingSignalMask).toEqual(["inverseSugar"]);
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
    ...product(id, 1, null, 1, "other"),
    category,
    nutritionBasis: basis,
    matchScore: mask.length === 2 ? 50 : null,
    matchReason: mask.length === 2 ? "complete" : "limited_nutrition",
    ratingBasis,
    ratingStatus: mask.length === 2 ? "complete" : "limited_signal",
    ratingSignalCount: mask.length,
    ratingSignalMask: mask,
    criterionScores: criteria
  };
}

describe("compareFairCohorts", () => {
  const high = comparable("high", "protein bar", "100g", "barbora_reference", {
    protein: 90,
    inverseSugar: 70
  });
  const low = comparable("low", "protein bar", "100g", "barbora_reference", {
    protein: 55,
    inverseSugar: 55
  });

  it("compares the common protein and sugar signals stably", () => {
    const forward = compareFairCohorts([high, low]);
    const reverse = compareFairCohorts([low, high]);
    expect(forward).toEqual(reverse);
    expect(forward.cohorts[0]).toMatchObject({
      productIds: ["high", "low"],
      signalMask: ["protein", "inverseSugar"],
      winnerId: "high"
    });
  });

  it("does not name a winner when the score gap is under five", () => {
    const near = comparable("near", "protein bar", "100g", "barbora_reference", {
      protein: 87,
      inverseSugar: 68
    });
    expect(compareFairCohorts([high, near]).cohorts[0].winnerId).toBeNull();
  });

  it.each([
    ["category", { category: "drink" }],
    ["nutrition basis", { nutritionBasis: "100ml" as const }],
    ["scoring method", { ratingBasis: "catalog_percentile" as const }]
  ])("never mixes products with a different %s", (_label, override) => {
    expect(compareFairCohorts([high, { ...low, ...override }]).cohorts).toEqual([]);
  });

  it("requires both common signals", () => {
    const sugarOnly = comparable("sugar-only", "protein bar", "100g", "barbora_reference_partial", {
      protein: null,
      inverseSugar: 55
    });
    expect(compareFairCohorts([low, sugarOnly]).cohorts).toEqual([]);
  });

  it("ignores an identity-only product with missing rating metadata", () => {
    const identityOnly = {
      ...comparable("identity", "protein bar", "100g", "barbora_reference_partial", {
        protein: null,
        inverseSugar: null
      }),
      ratingBasis: null as unknown as ScoredProduct["ratingBasis"],
      ratingStatus: "identity_only" as const,
      ratingSignalCount: 0,
      ratingSignalMask: [],
      criterionScores: null
    };
    expect(compareFairCohorts([high, identityOnly])).toEqual({ cohorts: [], winnerIds: [] });
  });
});

describe("rankSimilarProducts", () => {
  it("keeps only interchangeable Barbora products with an equal or better fit", () => {
    const scored = scoreCatalog([
      product("current", 20, null, 8, "bar"),
      product("better", 30, null, 2, "bar"),
      product("worse", 10, null, 30, "bar"),
      product("different", 40, null, 0, "cookie")
    ]).map((item) => ({ ...item, retailerUrl: `https://barbora.lv/produkti/${item.id}` }));
    expect(rankSimilarProducts(scored[0], scored).map((item) => item.id)).toEqual(["better"]);
  });
});
