import { describe, expect, it } from "vitest";
import { getCatalog } from "./catalog";

describe("Latvia catalog", () => {
  it("contains exactly 40 constrained products and exact Barbora links", () => {
    const catalog = getCatalog();
    expect(catalog).toHaveLength(40);
    expect(new Set(catalog.map((product) => product.id)).size).toBe(40);
    expect(catalog.every((product) => product.retailerUrl.startsWith("https://barbora.lv/produkti/"))).toBe(true);
  });

  it("scores only products with all three verified numeric inputs", () => {
    const catalog = getCatalog();
    expect(catalog.filter((product) => product.isGolden)).toHaveLength(10);
    expect(catalog.filter((product) => product.matchScore !== null)).toHaveLength(10);
    for (const product of catalog) {
      const complete = Object.values(product.nutrientsPer100g).every((value) => value !== null);
      expect(product.matchScore !== null).toBe(complete);
    }
  });
});
