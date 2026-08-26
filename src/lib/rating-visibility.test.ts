import { describe, expect, it } from "vitest";
import type { ScoredProduct } from "./types";
import { displayableScanProductIds, hasSugarNoRating, ratedScanProductIds } from "./rating-visibility";

function product(matchScore: number | null, signalCount = matchScore === null ? 1 : 2): ScoredProduct {
  return { matchScore, ratingSignalCount: signalCount } as ScoredProduct;
}

describe("Sugar.no rating visibility", () => {
  it("highlights numeric ratings including the lowest possible score", () => {
    expect(hasSugarNoRating(product(0))).toBe(true);
    expect(hasSugarNoRating(product(82))).toBe(true);
  });

  it("does not highlight missing or still-loading nutrition", () => {
    expect(hasSugarNoRating(product(null))).toBe(false);
    expect(hasSugarNoRating(product(null, 1))).toBe(false);
    expect(hasSugarNoRating(undefined)).toBe(false);
  });

  it("omits a price-only identity from visible scan results", () => {
    const products = {
      rated: product(61),
      "price-only": product(null, 0)
    };

    expect(ratedScanProductIds(["rated", "price-only", "missing"], products)).toEqual(["rated"]);
    expect(displayableScanProductIds(["rated", "price-only", "missing"], products, new Set())).toEqual(["rated"]);
  });

  it("keeps an identity visible only while its nutrition lookup is pending", () => {
    expect(displayableScanProductIds(["pending"], {}, new Set(["pending"]))).toEqual(["pending"]);
    expect(displayableScanProductIds(["pending"], {}, new Set())).toEqual([]);
  });
});
