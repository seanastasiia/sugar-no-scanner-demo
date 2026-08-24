import { describe, expect, it } from "vitest";
import type { ScoredProduct } from "./types";
import {
  globalBestProductId,
  matchCriteria,
  overallMatchPresentation,
  overlayMatchPresentation,
  partialNutritionExplanation
} from "./match-presentation";

function scoredProduct(
  score: number | null,
  breakdown: ScoredProduct["criterionScores"]
): ScoredProduct {
  return {
    id: "demo",
    retailerProductId: "demo",
    brand: "Demo",
    name: "Demo product",
    shortName: "Demo",
    aliases: [],
    format: "bar",
    packSizeG: 50,
    gtin: null,
    nutrientsPer100g: { proteinG: 30, fiberG: 6, totalSugarG: 3 },
    noAddedSugarClaim: false,
    imageUrl: null,
    retailerUrl: "https://barbora.lv/produkti/demo",
    sources: [],
    isGolden: true,
    accent: "coral",
    matchScore: score,
    matchReason: score === null ? "missing_nutrition" : "complete",
    ratingBasis: "catalog_percentile",
    ratingStatus: score === null ? "identity_only" : "complete",
    ratingSignalCount: score === null ? 0 : 3,
    ratingSignalMask: score === null ? [] : ["protein", "fiber", "inverseSugar"],
    criterionScores: breakdown
  };
}

describe("match presentation", () => {
  it("only declares a global best for one fair cohort with one winner", () => {
    expect(globalBestProductId({ cohorts: [{}], winnerIds: ["winner"] })).toBe("winner");
    expect(globalBestProductId({ cohorts: [{}, {}], winnerIds: ["first", "second"] })).toBeUndefined();
    expect(globalBestProductId({ cohorts: [{}], winnerIds: [] })).toBeUndefined();
  });

  it("maps the hidden score to three plain-language shelf states", () => {
    expect(overallMatchPresentation(86)).toEqual({ label: "Great fit", tone: "strong" });
    expect(overallMatchPresentation(63)).toEqual({ label: "Moderate fit", tone: "middle" });
    expect(overallMatchPresentation(43)).toEqual({ label: "Low fit", tone: "lower" });
    expect(overallMatchPresentation(null)).toEqual({ label: "Data pending", tone: "pending" });
  });

  it("uses inverse direction for sugar and text in addition to color", () => {
    const criteria = matchCriteria(scoredProduct(67, { protein: 90, fiber: 50, inverseSugar: 10 }));
    expect(criteria).toEqual([
      { key: "protein", label: "Protein", status: "Higher", tone: "strong" },
      { key: "fiber", label: "Fiber", status: "Middle", tone: "middle" },
      { key: "sugar", label: "Sugar", status: "Higher", tone: "lower" }
    ]);
  });

  it("keeps every criterion pending when one required value is unverified", () => {
    expect(matchCriteria(scoredProduct(null, null)).every((criterion) => criterion.status === "Pending")).toBe(true);
  });

  it("shows an omitted fiber value as not listed without downgrading it", () => {
    const partial = {
      ...scoredProduct(60, { protein: 100, fiber: null, inverseSugar: 20 }),
      matchReason: "partial_nutrition" as const,
      ratingBasis: "barbora_reference_partial" as const,
      ratingStatus: "partial_overall" as const,
      ratingSignalCount: 2,
      ratingSignalMask: ["protein", "inverseSugar"] as ScoredProduct["ratingSignalMask"],
      nutrientsPer100g: { proteinG: 22, fiberG: null, totalSugarG: 14 }
    };
    expect(matchCriteria(partial)[1]).toEqual({
      key: "fiber",
      label: "Fiber",
      status: "Not listed",
      tone: "pending"
    });
  });

  it("presents three source-backed signals as a full solid fit", () => {
    expect(overlayMatchPresentation(scoredProduct(86, { protein: 90, fiber: 80, inverseSugar: 88 }))).toEqual({
      label: "Great fit",
      tone: "strong",
      completeness: "full",
      completenessLabel: "3/3 signals",
      signalCount: 3
    });
  });

  it("makes a two-signal fit explicitly partial", () => {
    const product = {
      ...scoredProduct(63, { protein: 80, fiber: null, inverseSugar: 46 }),
      ratingSignalCount: 2,
      ratingStatus: "partial_overall" as const,
      ratingSignalMask: ["protein", "inverseSugar"] as ScoredProduct["ratingSignalMask"],
      matchReason: "partial_nutrition" as const
    };
    expect(overlayMatchPresentation(product)).toMatchObject({
      label: "Moderate fit",
      completeness: "partial",
      completenessLabel: "2/3 signals"
    });
  });

  it("keeps one-signal and identified-only packages neutral", () => {
    const limited = {
      ...scoredProduct(null, { protein: 92, fiber: null, inverseSugar: null }),
      ratingSignalCount: 1,
      ratingStatus: "limited_signal" as const,
      ratingSignalMask: ["protein"] as ScoredProduct["ratingSignalMask"],
      matchReason: "limited_nutrition" as const
    };
    expect(overlayMatchPresentation(limited)).toMatchObject({
      label: "Limited view",
      tone: "pending",
      completeness: "limited",
      completenessLabel: "1/3 signal"
    });
    expect(overlayMatchPresentation()).toMatchObject({
      label: "Identified",
      tone: "pending",
      completeness: "identified"
    });
  });

  it.each([
    [["protein", "fiber"], "Protein and fiber are source-backed. Total sugar is not listed, so this is not the full three-signal fit."],
    [["protein", "inverseSugar"], "Protein and total sugar are source-backed. Fiber is not listed, so this is not the full three-signal fit."],
    [["fiber", "inverseSugar"], "Fiber and total sugar are source-backed. Protein is not listed, so this is not the full three-signal fit."]
  ] as const)("describes the exact two-signal mask %j", (mask, expected) => {
    expect(partialNutritionExplanation([...mask])).toBe(expected);
  });
});
