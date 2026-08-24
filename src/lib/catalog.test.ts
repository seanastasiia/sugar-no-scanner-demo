import { describe, expect, it } from "vitest";
import { getCatalog } from "./catalog";

describe("Latvia catalog", () => {
  it("contains exactly 40 constrained products and exact Barbora links", () => {
    const catalog = getCatalog();
    expect(catalog).toHaveLength(40);
    expect(new Set(catalog.map((product) => product.id)).size).toBe(40);
    expect(catalog.every((product) => product.retailerUrl.startsWith("https://barbora.lv/produkti/"))).toBe(true);
  });

  it("distinguishes complete three-signal ratings from honest two-signal partial ratings", () => {
    const catalog = getCatalog();
    expect(catalog.filter((product) => product.isGolden)).toHaveLength(10);
    expect(catalog.filter((product) => product.ratingStatus === "complete")).toHaveLength(10);
    expect(catalog.filter((product) => product.ratingStatus === "partial_overall")).toHaveLength(30);
    for (const product of catalog) {
      const sourceBackedSignalCount = Object.values(product.nutrientsPer100g).filter(
        (value) => typeof value === "number" && Number.isFinite(value)
      ).length;
      expect(product.ratingSignalCount).toBe(sourceBackedSignalCount);
      expect(product.matchScore !== null).toBe(sourceBackedSignalCount >= 2);
      expect(product.ratingStatus).toBe(sourceBackedSignalCount === 3 ? "complete" : "partial_overall");
    }
  });
});
