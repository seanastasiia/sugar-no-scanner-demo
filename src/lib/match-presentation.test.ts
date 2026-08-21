import { describe, expect, it } from "vitest";
import type { ScoredProduct } from "./types";
import { matchCriteria, overallMatchPresentation } from "./match-presentation";

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
    ratingSignalCount: score === null ? 0 : 3,
    criterionScores: breakdown
  };
}

describe("match presentation", () => {
  it("maps the hidden score to three plain-language shelf states", () => {
    expect(overallMatchPresentation(86)).toEqual({ label: "Top fit", tone: "strong" });
    expect(overallMatchPresentation(63)).toEqual({ label: "Mixed", tone: "middle" });
    expect(overallMatchPresentation(43)).toEqual({ label: "Trade-offs", tone: "lower" });
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
      ratingSignalCount: 2,
      nutrientsPer100g: { proteinG: 22, fiberG: null, totalSugarG: 14 }
    };
    expect(matchCriteria(partial)[1]).toEqual({
      key: "fiber",
      label: "Fiber",
      status: "Not listed",
      tone: "pending"
    });
  });
});
