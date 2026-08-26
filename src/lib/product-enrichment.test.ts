import { describe, expect, it } from "vitest";
import type { ProductDetection } from "@/lib/types";
import { mapWithConcurrency, mergeProgressiveEnrichment } from "./product-enrichment";

function detection(productId: string, matchKind: "visual_only" | "web_search" = "visual_only"): ProductDetection {
  return {
    productId,
    catalogProductId: null,
    confidence: 0.94,
    box: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    observedText: productId,
    identity: {
      brand: "Turtle",
      name: productId,
      variant: null,
      packSize: "300 g",
      category: "Packaged snacks",
      matchKind
    },
    shelfPrice: null,
    retailerOffer: null
  };
}

describe("progressive product enrichment", () => {
  it("updates only the product whose internet lookup completed", () => {
    const first = detection("visual:first");
    const second = detection("visual:second");
    const resolvedSecond = detection("web:second", "web_search");

    expect(mergeProgressiveEnrichment([first, second], second, resolvedSecond)).toEqual([
      first,
      expect.objectContaining({ productId: "web:second", identity: expect.objectContaining({ matchKind: "web_search" }) })
    ]);
  });

  it("runs at most five independent lookups at once", async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 10 }, (_, index) => index), 5, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
    });
    expect(peak).toBe(5);
  });
});
