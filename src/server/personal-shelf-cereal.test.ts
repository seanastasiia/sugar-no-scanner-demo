import { describe, expect, it } from "vitest";
import { getExternalCatalogProductById, resolveExternalCatalogProduct, resolveExternalCatalogIdentity } from "./external-catalog";
import { assessPersonalShelfProduct, rankPersonalShelfProducts } from "../lib/personal-shelf-rank";
import { REVIEWED_CEREAL_LABELS, withReviewedPackageAliases } from "./reviewed-package-aliases";
import snapshot from "../../data/livinn-catalog.generated.json";
import type { ExternalCatalogProduct } from "./external-catalog-types";

// Real exact-source records visible on the owner's Turtle shelf, not invented nutrients.
const shelf = [
  ["TURT3022", 40], ["TURT3024", 59], ["TURT3036", 76], ["TURT3038", 51],
  ["TURT3041", 29], ["TURT3044", 79], ["TURT3048", 50], ["TURT3070", 69]
] as const;

describe("exact Turtle cereal shelf evidence", () => {
  it.each(REVIEWED_CEREAL_LABELS)("matches the reviewed English package label $sku to its Lithuanian source", ({ sku, pack, labels }) => {
    for (const name of labels) {
      const input = { brand: "Turtle", name, variant: "", packSize: pack, searchTerms: [`Turtle ${name} ${pack}`] };
      expect(resolveExternalCatalogProduct(input)?.product.id).toBe(`livinn_lt:${sku}`);
      expect(resolveExternalCatalogIdentity(input)?.product.id).toBe(`livinn_lt:${sku}`);
      expect(resolveExternalCatalogProduct({ ...input, packSize: "999g" })).toBeNull();
      expect(resolveExternalCatalogProduct({ ...input, brand: "Other brand" })).toBeNull();
    }
  });
  it("does not assign a known recipe to an unreadable or different cereal variant", () => {
    for (const name of ["Cocoa Pillows Strawberry", "Cocoa Pillows Hazelnut Strawberry filling", "Low Sugar Pillows Peanut butter caramel", "Cornflakes White Chocolate", "Granola", "Pillows"]) {
      expect(resolveExternalCatalogProduct({ brand: "Turtle", name, variant: "", packSize: "300g", searchTerms: [] })).toBeNull();
    }
  });
  it("disables reviewed labels when the exact retailer source metadata changes", () => {
    const source = (snapshot as ExternalCatalogProduct[]).find((row) => row.sourceProductId === "TURT3044")!;
    expect(withReviewedPackageAliases(source).aliases).toContain("Turtle Low Sugar Pillows Peanut butter");
    for (const change of [{ imageUrl: "https://images.livinn.lt/other.png" }, { packSize: "350 g" }, { sourceProductId: "TURT-other" }, { brand: "Other" }, { url: "https://www.livinn.lt/p/other" }]) {
      const changed = { ...source, ...change };
      expect(withReviewedPackageAliases(changed)).toBe(changed);
    }
  });
  it.each(shelf)("assesses %s from its own Livinn observation", (sku, score) => {
    const product = getExternalCatalogProductById(`livinn_lt:${sku}`);
    expect(product).not.toBeNull();
    const before = structuredClone(product);
    expect(product!.shelfEvidence?.productId).toBe(product!.id);
    expect(product!.shelfEvidence?.ingredientsLanguage).toBe("lt");
    expect(product!.shelfEvidence?.sourceUrl).toBe(product!.retailerUrl);
    const assessment = assessPersonalShelfProduct(product!);
    expect(assessment.category).toBe("breakfast-cereal");
    expect(assessment.status).toBe("scored");
    expect(assessment.score).toBe(score);
    expect(product).toEqual(before);
  });
  it("ranks all eight together, without silently dropping cereal packages", () => {
    const products = shelf.map(([sku]) => getExternalCatalogProductById(`livinn_lt:${sku}`)!);
    const ranked = rankPersonalShelfProducts(products);
    expect(ranked.unsupported).toHaveLength(0);
    expect(ranked.groups).toHaveLength(1);
    expect(ranked.groups[0].scoredCount).toBe(8);
    expect(ranked.groups[0].entries.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(ranked.groups[0].entries[0].product.id).toBe("livinn_lt:TURT3044");
  });
});
