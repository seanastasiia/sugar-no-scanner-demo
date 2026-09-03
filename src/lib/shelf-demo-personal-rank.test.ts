import { describe, expect, it } from "vitest";
import snapshot from "../../data/shelf-demo-evidence.generated.json";
import { getCatalog } from "./catalog";
import { assessPersonalShelfProduct, rankPersonalShelfProducts, type ShelfEvidence } from "./personal-shelf-rank";
import { shelfDemoPersonalProduct } from "./shelf-demo-personal-rank";
import { SHELF_DEMO_PRODUCTS, shelfDemoOriginalId } from "./shelf-demo-products";
import { sampleResponse } from "../server/demo-scenes";

const demo = SHELF_DEMO_PRODUCTS.map((spec) => getCatalog().find((p) => p.id === spec.id)!);
const observations = snapshot as Array<{ title: string; evidence: ShelfEvidence }>;

describe("ordinary Shelf demo personal ranking", () => {
  it("covers exactly the four existing scene products with whole exact observations", () => {
    expect(sampleResponse("sample-shelf")?.map((d) => d.productId).sort()).toEqual(demo.map((p) => p.id).sort());
    expect(observations).toHaveLength(4);
    for (const product of demo) {
      const prepared = shelfDemoPersonalProduct(product);
      expect(prepared.id).toBe(`barbora:${product.id}`);
      expect(prepared.format).toBe("bar");
      expect(prepared.shelfEvidence).toBe(observations.find((row) => row.evidence.productId === prepared.id)!.evidence);
      expect(prepared.shelfEvidence?.sourceUrl).toBe(product.retailerUrl);
      expect(prepared.shelfEvidence?.proteinG).toBe(product.nutrientsPer100g.proteinG);
      expect(prepared.shelfEvidence?.totalSugarG).toBe(product.nutrientsPer100g.totalSugarG);
      expect(shelfDemoOriginalId(prepared.id)).toBe(product.id);
      expect(prepared.shelfEvidence?.fiberG).toBeNull();
      expect(assessPersonalShelfProduct(prepared).scoreRange).toEqual({ min: 59, max: 59 });
      expect(assessPersonalShelfProduct(prepared).components.find((part) => part.key === "composition")?.points).toBe(6.3);
    }
  });
  it("shares the capped place without inventing a winner or changing original Fit", () => {
    const before = structuredClone(demo);
    const result = rankPersonalShelfProducts(demo.map((p) => shelfDemoPersonalProduct(p)));
    expect(result.unsupported).toEqual([]);
    expect(result.groups.map((g) => [g.category, g.total, g.scoredCount])).toEqual([["bar", 4, 4]]);
    expect(result.groups[0].entries.map((e) => e.rank)).toEqual([1, 1, 1, 1]);
    expect(result.groups[0].entries.every((e) => e.rankProvisional && e.assessment.cap?.includes("saturated fat"))).toBe(true);
    expect(demo).toEqual(before);
    expect(demo[2].format).toBe("cookie"); // Only the pilot copy corrects the legacy category.
  });
  it("fails closed for missing, mismatched and different-pack evidence", () => {
    const p = demo[0];
    const row = observations.find((entry) => entry.evidence.productId === `barbora:${p.id}`)!;
    expect(shelfDemoPersonalProduct(p, [])).toBe(p);
    for (const changed of [
      { ...p, brand: "Another brand" }, { ...p, packSizeG: 40 },
      { ...p, retailerUrl: "https://barbora.lv/produkti/different-flavour" },
      { ...p, id: "unrelated", retailerUrl: p.retailerUrl }
    ]) expect(shelfDemoPersonalProduct(changed)).toBe(changed);
    for (const changed of [
      { ...row, title: "Other product 55g" },
      { ...row, evidence: { ...row.evidence, sourceUrl: "https://barbora.lv/produkti/other" } },
      { ...row, evidence: { ...row.evidence, productId: "barbora:other" } }
    ]) expect(shelfDemoPersonalProduct(p, [changed])).toBe(p);
    const withGtin = { ...p, gtin: "4750000000001" };
    expect(shelfDemoPersonalProduct(withGtin, [{ ...row, evidence: { ...row.evidence, gtin: "4750000000002" } }])).toBe(withGtin);
  });
});
