import { describe, expect, it } from "vitest";
import type { ScoredProduct } from "./types";
import {
  globalBestProductId,
  matchCriteria,
  overallMatchPresentation,
  overlayMatchPresentation,
  partialNutritionExplanation,
  rankScanProductIds
} from "./match-presentation";

function scoredProduct(score: number | null, breakdown: ScoredProduct["criterionScores"]): ScoredProduct {
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
    ratingSignalCount: score === null ? 0 : 2,
    ratingSignalMask: score === null ? [] : ["protein", "inverseSugar"],
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

  it("orders rated scan products from higher to lower fit and leaves unrated products last", () => {
    expect(
      rankScanProductIds(
        ["pending-a", "moderate", "great", "low", "pending-b", "great-tie", "great"],
        {
          "pending-a": { matchScore: null },
          moderate: { matchScore: 58 },
          great: { matchScore: 82 },
          low: { matchScore: 31 },
          "pending-b": undefined,
          "great-tie": { matchScore: 82 }
        }
      )
    ).toEqual(["great", "great-tie", "moderate", "low", "pending-a", "pending-b"]);
  });

  it("uses inverse direction for sugar and text in addition to color", () => {
    expect(matchCriteria(scoredProduct(50, { protein: 90, inverseSugar: 10 }))).toEqual([
      { key: "protein", label: "Protein", status: "Higher", tone: "strong" },
      { key: "sugar", label: "Sugar", status: "Higher", tone: "lower" }
    ]);
  });

  it("keeps both criteria pending when nutrition is unverified", () => {
    expect(matchCriteria(scoredProduct(null, null))).toEqual([
      { key: "protein", label: "Protein", status: "Pending", tone: "pending" },
      { key: "sugar", label: "Sugar", status: "Pending", tone: "pending" }
    ]);
  });

  it("presents two source-backed signals as a full fit", () => {
    expect(overlayMatchPresentation(scoredProduct(86, { protein: 90, inverseSugar: 88 }))).toEqual({
      label: "Great fit",
      tone: "strong",
      completeness: "full",
      completenessLabel: "2/2 signals",
      signalCount: 2
    });
  });

  it("keeps one-signal and identified-only packages neutral", () => {
    const limited = {
      ...scoredProduct(null, { protein: 92, inverseSugar: null }),
      ratingSignalCount: 1,
      ratingStatus: "limited_signal" as const,
      ratingSignalMask: ["protein"] as ScoredProduct["ratingSignalMask"],
      matchReason: "limited_nutrition" as const
    };
    expect(overlayMatchPresentation(limited)).toMatchObject({
      label: "Limited view",
      tone: "pending",
      completeness: "limited",
      completenessLabel: "1/2 signal"
    });
    expect(partialNutritionExplanation(["protein"])).toBe(
      "Protein is source-backed. Total sugar is not listed, so Sugar.no does not calculate an overall fit."
    );
    expect(overlayMatchPresentation()).toMatchObject({
      label: "Identified",
      tone: "pending",
      completeness: "identified"
    });
  });
});
