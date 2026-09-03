import { describe, expect, it, vi } from "vitest";
import { assessPersonalShelfProduct, rankPersonalShelfProducts } from "@/lib/personal-shelf-rank";
import { getShelfEvidence } from "./personal-shelf-evidence";
import { personalShelfDemoProducts, PERSONAL_SHELF_DEMO_IDS } from "./personal-shelf-demo";

describe("personal shelf catalog demo", () => {
  it("uses four exact existing chips without network or synthetic nutrition", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const products = personalShelfDemoProducts();
      expect(products.map((p) => p.id)).toEqual(PERSONAL_SHELF_DEMO_IDS);
      for (const product of products) {
        expect(product.shelfEvidence).toEqual(getShelfEvidence(product.id));
        expect(product.imageUrl).toMatch(/^https:\/\//);
      }
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(products.map((p) => assessPersonalShelfProduct(p).score)).toEqual([64, 61, null, null]);
      expect(assessPersonalShelfProduct(products[3]).scoreRange).toEqual({ min: 57, max: 59 });
    } finally { fetchSpy.mockRestore(); }
  });

  it("keeps category ranks separate and the contradictory chip outside the denominator", () => {
    const products = personalShelfDemoProducts();
    const { groups, unsupported } = rankPersonalShelfProducts(products);
    expect(unsupported).toEqual([]);
    expect(groups.map((g) => [g.category, g.total, g.scoredCount])).toEqual([["chips", 4, 3]]);
    expect(groups[0].entries.map((e) => e.rank)).toEqual([1, 2, 3, null]);
    expect(products[2].matchScore).toBeNull();
    expect(products[2].shelfEvidence?.proteinG).toBe(57.8);
    expect(products[2].nutrientsPer100g.proteinG).toBeNull();
  });
});
