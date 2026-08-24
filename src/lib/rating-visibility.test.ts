import { describe, expect, it } from "vitest";
import type { ScoredProduct } from "./types";
import { hasSugarNoRating } from "./rating-visibility";

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
});
