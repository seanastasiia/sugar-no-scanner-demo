import { describe, expect, it } from "vitest";
import { externalCatalogToScoredProduct, rankExternalCatalogCandidates } from "./external-catalog";
import type { ExternalCatalogProduct } from "./external-catalog-types";

const product: ExternalCatalogProduct = {
  source: "rimi_lv",
  sourceProductId: "100761",
  retailer: "Rimi",
  url: "https://www.rimi.lv/e-veikals/lv/produkti/example/p/100761",
  title: "Konfektes Geisha piena šokolādes 150g",
  brand: "Geisha",
  gtin: null,
  sku: "100761",
  category: "Chocolate",
  packSize: "150g",
  nutritionBasis: "100g",
  energyKcal: 550,
  proteinG: 8,
  totalSugarG: 49,
  imageUrl: null,
  price: 5.69,
  currency: "EUR",
  available: true,
  checkedAt: "2026-08-26T00:00:00.000Z"
};

describe("external retailer catalog", () => {
  it("requires brand, product identity and pack size", () => {
    const input = {
      brand: "Geisha",
      name: "piena šokolādes konfektes 150g",
      variant: "piena šokolādes",
      packSize: "150g",
      searchTerms: ["Geisha piena šokolādes 150g"]
    };
    expect(rankExternalCatalogCandidates(input, [product])[0]?.confidence).toBeGreaterThanOrEqual(0.84);
    expect(rankExternalCatalogCandidates({ ...input, packSize: "300g" }, [product])).toEqual([]);
    expect(rankExternalCatalogCandidates({ ...input, brand: "Fazer" }, [product])).toEqual([]);
  });

  it("preserves retailer provenance in the scored product", () => {
    const scored = externalCatalogToScoredProduct(product);
    expect(scored.id).toBe("rimi_lv:100761");
    expect(scored.ratingBasis).toBe("retailer_catalog_reference");
    expect(scored.nutrientsPer100g).toMatchObject({ proteinG: 8, totalSugarG: 49 });
    expect(scored.sources[0].url).toBe(product.url);
  });
});
