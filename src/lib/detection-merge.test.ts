import { describe, expect, it } from "vitest";
import type { ProductDetection } from "./types";
import { mergeEnrichedDetections } from "./detection-merge";

const initial: ProductDetection = {
  productId: "visual:test",
  confidence: 0.8,
  box: { x: 0.1, y: 0.1, width: 0.3, height: 0.4 },
  observedText: "Test 50 g",
  identity: {
    brand: "Brand",
    name: "Test",
    variant: "Vanilla",
    packSize: "50 g",
    category: "bar",
    matchKind: "visual_only"
  },
  shelfPrice: { amount: 2.5, currency: "EUR", observedText: "€2.50", confidence: 0.9 }
};

describe("mergeEnrichedDetections", () => {
  it("keeps visual geometry and price while upgrading the grounded identity", () => {
    const [merged] = mergeEnrichedDetections([initial], [
      {
        ...initial,
        productId: "catalog:test",
        catalogProductId: "catalog:test",
        identity: { ...initial.identity!, variant: null, packSize: null, matchKind: "barbora" },
        shelfPrice: null
      }
    ]);

    expect(merged).toMatchObject({
      productId: "catalog:test",
      catalogProductId: "catalog:test",
      identity: { variant: "Vanilla", packSize: "50 g", matchKind: "barbora" },
      shelfPrice: { amount: 2.5 }
    });
  });

  it("keeps the initial result when no resolved row exists", () => {
    expect(mergeEnrichedDetections([initial], [])).toEqual([initial]);
  });
});
