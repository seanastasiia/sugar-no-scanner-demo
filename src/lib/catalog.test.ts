import { describe, expect, it } from "vitest";
import { getCatalog } from "./catalog";

describe("Latvia catalog", () => {
  it("contains exactly 40 constrained products and exact Barbora links", () => {
    const catalog = getCatalog();
    expect(catalog).toHaveLength(40);
    expect(new Set(catalog.map((product) => product.id)).size).toBe(40);
    expect(catalog.every((product) => product.retailerUrl.startsWith("https://barbora.lv/produkti/"))).toBe(true);
  });

  it("rates all curated products from protein and total sugar", () => {
    const catalog = getCatalog();
    expect(catalog.filter((product) => product.isGolden)).toHaveLength(10);
    expect(catalog.filter((product) => product.ratingStatus === "complete")).toHaveLength(40);
    expect(catalog.filter((product) => product.ratingStatus === "partial_overall")).toHaveLength(0);
    for (const product of catalog) {
      expect(product.ratingSignalCount).toBe(2);
      expect(product.ratingSignalMask).toEqual(["protein", "inverseSugar"]);
      expect(product.matchScore).toBeTypeOf("number");
      expect(product.ratingStatus).toBe("complete");
    }
  });
});
