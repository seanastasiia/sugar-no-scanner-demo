import { describe, expect, it } from "vitest";
import { areInterchangeable, hasGreatFit, interchangeabilityKey, rankAvailableBetterAlternatives } from "./better-alternatives";
import type { RetailerOffer, ScoredProduct } from "./types";

function product(overrides: Partial<ScoredProduct> & Pick<ScoredProduct, "id" | "name">): ScoredProduct {
  return {
    retailerProductId: overrides.id,
    brand: "Test",
    shortName: overrides.name,
    aliases: [],
    format: "other",
    category: "Bakaleja/Mērces/Sinepes",
    packSizeG: 200,
    nutritionBasis: "100g",
    energyKcalPer100: 100,
    gtin: null,
    nutrientsPer100g: { proteinG: 2, fiberG: null, totalSugarG: 5 },
    noAddedSugarClaim: false,
    imageUrl: null,
    retailerUrl: `https://barbora.lv/produkti/${overrides.id}`,
    sources: [],
    isGolden: false,
    accent: "coral",
    matchScore: 55,
    matchReason: "complete",
    ratingBasis: "barbora_reference",
    ratingStatus: "complete",
    ratingSignalCount: 2,
    ratingSignalMask: ["protein", "inverseSugar"],
    criterionScores: { protein: 55, inverseSugar: 55 },
    ...overrides
  };
}

function offer(slug: string, price: number): RetailerOffer {
  return {
    retailer: "Barbora",
    slug,
    title: slug,
    brand: "Test",
    url: `https://barbora.lv/produkti/${slug}`,
    price,
    currency: "EUR",
    unitPrice: null,
    unit: null,
    imageUrl: null,
    checkedAt: "2026-08-26T00:00:00.000Z",
    matchConfidence: 1,
    exactSku: true
  };
}

describe("interchangeabilityKey", () => {
  it("separates a protein bar from a generic snack bar in the same retailer category", () => {
    const proteinBar = product({ id: "protein", name: "Proteīna batoniņš 50g", category: "Bakaleja/Saldumi/Šokolādes batoniņi" });
    const snackBar = product({ id: "snack", name: "Ābolu batoniņš 50g", category: "Bakaleja/Saldumi/Šokolādes batoniņi" });
    expect(interchangeabilityKey(proteinBar)).not.toBe(interchangeabilityKey(snackBar));
    expect(areInterchangeable(proteinBar, snackBar)).toBe(false);
  });

  it("fails closed for an untyped product in a broad retailer bucket", () => {
    expect(interchangeabilityKey(product({ id: "broad", name: "Unknown snack", category: "Bakaleja/Uzkodas/Citas uzkodas" }))).toBeNull();
  });
});

describe("rankAvailableBetterAlternatives", () => {
  it("requires a live exact offer, Great fit and a fit no worse than the current product", () => {
    const current = product({ id: "current", name: "Sinepes 200g", matchScore: 55 });
    const better = product({ id: "better", name: "Dižonas sinepes 210g", matchScore: 100 });
    const moderate = product({ id: "moderate", name: "Maigas sinepes 200g", matchScore: 60 });
    const worse = product({ id: "worse", name: "Saldās sinepes 200g", matchScore: 20 });
    const unavailable = product({ id: "unavailable", name: "Graudainās sinepes 180g", matchScore: 100 });
    const result = rankAvailableBetterAlternatives(
      current,
      [worse, moderate, unavailable, better],
      {
        better: offer("better", 1.49),
        moderate: offer("moderate", 0.79),
        worse: offer("worse", 0.99),
        unavailable: null
      },
      (candidate) => candidate.id
    );
    expect(result.map((candidate) => candidate.id)).toEqual(["better"]);
  });

  it("hides the block when no Great fit substitute is available", () => {
    const current = product({ id: "current", name: "Sinepes 200g", matchScore: 55 });
    const moderate = product({ id: "moderate", name: "Maigas sinepes 200g", matchScore: 60 });
    expect(
      rankAvailableBetterAlternatives(
        current,
        [moderate],
        { moderate: offer("moderate", 0.79) },
        (candidate) => candidate.id
      )
    ).toEqual([]);
  });

  it("uses lower price and then nearest pack size only when fit is equal", () => {
    const current = product({ id: "current", name: "Sinepes 200g", matchScore: 55, packSizeG: 200 });
    const expensive = product({ id: "expensive", name: "Sinepes A 205g", matchScore: 100, packSizeG: 205 });
    const cheapFar = product({ id: "cheap-far", name: "Sinepes B 300g", matchScore: 100, packSizeG: 300 });
    const cheapNear = product({ id: "cheap-near", name: "Sinepes C 210g", matchScore: 100, packSizeG: 210 });
    const offers = {
      expensive: offer("expensive", 2.49),
      "cheap-far": offer("cheap-far", 1.49),
      "cheap-near": offer("cheap-near", 1.49)
    };
    expect(
      rankAvailableBetterAlternatives(current, [expensive, cheapFar, cheapNear], offers, (candidate) => candidate.id)
        .map((candidate) => candidate.id)
    ).toEqual(["cheap-near", "cheap-far", "expensive"]);
  });
});

describe("hasGreatFit", () => {
  it.each([
    [null, false],
    [49, false],
    [50, false],
    [66, false],
    [67, true],
    [100, true]
  ])("classifies score %s with the shared Sugar.no fit thresholds", (matchScore, expected) => {
    expect(hasGreatFit({ matchScore })).toBe(expected);
  });
});
