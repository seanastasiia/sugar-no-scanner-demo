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

function rimiProduct(sourceProductId: string, title: string, packSize: string): ExternalCatalogProduct {
  return {
    ...product,
    sourceProductId,
    url: `https://www.rimi.lv/e-veikals/lv/produkti/example/p/${sourceProductId}`,
    title,
    brand: "Rimi",
    sku: sourceProductId,
    packSize
  };
}

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

  it("matches bilingual Rimi private-label identities without web lookup", () => {
    const candidates = [
      rimiProduct("801291", "Sālsstandziņas Rimi 125g", "125g"),
      rimiProduct("801292", "Sālsstandziņas Rimi ar sieru 125g", "125g"),
      rimiProduct("812378", "Sulas dzēriens Rimi multiaugļu 200ml", "200ml"),
      rimiProduct("815162", "Sulas dzēriens Rimi Banānu un zemeņu 200ml", "200ml")
    ];
    const cases = [
      ["Pastry twists SALTY 125g", "125g", "801291"],
      ["Pastry twists CHEESE 125g", "125g", "801292"],
      ["Sulu dzēriens multi fruit 200ml", "200ml", "812378"],
      ["Sulu dzēriens strawberry banana 200ml", "200ml", "815162"]
    ];

    for (const [name, packSize, expectedId] of cases) {
      const ranked = rankExternalCatalogCandidates(
        { brand: "Rimi", name, variant: "", packSize, searchTerms: [name] },
        candidates
      );
      expect(ranked[0]?.product.sourceProductId).toBe(expectedId);
      expect(ranked[0]?.confidence).toBeGreaterThanOrEqual(0.84);
      expect(ranked[0]!.confidence - (ranked[1]?.confidence || 0)).toBeGreaterThanOrEqual(0.08);
    }
  });

  it("keeps a generic Rimi juice identity unresolved when variants are ambiguous", () => {
    const candidates = [
      rimiProduct("812378", "Sulas dzēriens Rimi multiaugļu 200ml", "200ml"),
      rimiProduct("815162", "Sulas dzēriens Rimi Banānu un zemeņu 200ml", "200ml")
    ];
    const ranked = rankExternalCatalogCandidates(
      { brand: "Rimi", name: "Juice drink 200ml", variant: "", packSize: "200ml", searchTerms: [] },
      candidates
    );
    expect(ranked[0]!.confidence - ranked[1]!.confidence).toBeLessThan(0.08);
  });
});
