import { describe, expect, it } from "vitest";
import type { ProductDetection, ScoredProduct } from "./types";
import {
  displayableScanProductIds,
  hasRecognizedProductIdentity,
  hasSugarNoRating,
  ratedScanProductIds
} from "./rating-visibility";

function product(matchScore: number | null, signalCount = matchScore === null ? 1 : 2): ScoredProduct {
  return { matchScore, ratingSignalCount: signalCount } as ScoredProduct;
}

function detection(name?: string): ProductDetection {
  return {
    productId: "visual:test",
    confidence: 0.96,
    box: { x: 0.1, y: 0.1, width: 0.4, height: 0.6 },
    observedText: name || "€0.69",
    identity: name
      ? {
          brand: "Test",
          name,
          variant: null,
          packSize: null,
          category: null,
          matchKind: "visual_only"
        }
      : undefined
  };
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

  it("omits an anonymous price-only finding from visible scan results", () => {
    const products = {
      rated: product(61),
      "price-only": product(null, 0)
    };

    expect(ratedScanProductIds(["rated", "price-only", "missing"], products)).toEqual(["rated"]);
    expect(
      displayableScanProductIds(["rated", "price-only", "missing"], products, new Set(), {
        "price-only": detection()
      })
    ).toEqual(["rated"]);
  });

  it("keeps a pending identity visible before the nutrition lookup finishes", () => {
    expect(displayableScanProductIds(["pending"], {}, new Set(["pending"]))).toEqual(["pending"]);
    expect(displayableScanProductIds(["pending"], {}, new Set())).toEqual([]);
  });

  it("keeps a confidently named product visible after nutrition lookup misses", () => {
    const named = detection("Turtle Cinnamon Crunch 300g");

    expect(hasRecognizedProductIdentity(named)).toBe(true);
    expect(
      displayableScanProductIds(["visual:test"], {}, new Set(), { "visual:test": named })
    ).toEqual(["visual:test"]);
  });

  it("does not treat generic model placeholders as product identities", () => {
    expect(hasRecognizedProductIdentity(detection("Product"))).toBe(false);
    expect(hasRecognizedProductIdentity(detection("Unknown product"))).toBe(false);
  });
});
