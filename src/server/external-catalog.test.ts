import { describe, expect, it } from "vitest";
import {
  dedupeExternalCatalogProducts,
  externalCatalogToScoredProduct,
  rankExternalCatalogCandidates
} from "./external-catalog";
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
  carbohydrateG: 54,
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
  it("uses pack size as supporting evidence and rejects an explicit conflict", () => {
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

  it("accepts an exact retailer identity without package size for per-100 nutrition", () => {
    const ranked = rankExternalCatalogCandidates(
      {
        brand: "Geisha",
        name: "piena šokolādes konfektes",
        variant: "piena šokolādes",
        packSize: "",
        searchTerms: ["Geisha piena šokolādes konfektes"]
      },
      [product]
    );

    expect(ranked[0]?.product.sourceProductId).toBe(product.sourceProductId);
    expect(ranked[0]?.confidence).toBeGreaterThanOrEqual(0.84);
  });

  it("keeps identical products with different package sizes ambiguous when no size is visible", () => {
    const ranked = rankExternalCatalogCandidates(
      {
        brand: "Rimi",
        name: "Sālsstandziņas Rimi",
        variant: "",
        packSize: "",
        searchTerms: []
      },
      [
        rimiProduct("small", "Sālsstandziņas Rimi 125g", "125g"),
        rimiProduct("large", "Sālsstandziņas Rimi 250g", "250g")
      ]
    );

    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.confidence - ranked[1]!.confidence).toBeLessThan(0.08);
  });

  it("preserves retailer provenance in the scored product", () => {
    const scored = externalCatalogToScoredProduct(product);
    expect(scored.id).toBe("rimi_lv:100761");
    expect(scored.ratingBasis).toBe("retailer_catalog_reference");
    expect(scored.nutrientsPer100g).toMatchObject({ proteinG: 8, totalSugarG: 49, carbohydrateG: 54 });
    expect(scored.sources[0].fields).toContain("carbohydrate");
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

  it("matches Russian identity text and decimal pack units to an exact Latvian SKU", () => {
    const candidates = [
      rimiProduct("801291", "Sālsstandziņas Rimi 125g", "125g"),
      rimiProduct("801292", "Sālsstandziņas Rimi ar sieru 125g", "125g")
    ];
    const ranked = rankExternalCatalogCandidates(
      { brand: "Rimi", name: "Солёные палочки", variant: "", packSize: "0,125 кг", searchTerms: [] },
      candidates
    );
    expect(ranked[0]?.product.sourceProductId).toBe("801291");
    expect(ranked[0]?.confidence).toBeGreaterThanOrEqual(0.84);
  });

  it("preserves decimal packs instead of treating 0,33 l as 33 litres", () => {
    const candidate = rimiProduct("330", "Dzēriens Rimi apelsīnu 330ml", "330ml");
    const ranked = rankExternalCatalogCandidates(
      { brand: "Rimi", name: candidate.title, variant: "", packSize: "0,33 l", searchTerms: [] },
      [candidate]
    );
    expect(ranked[0]?.product.sourceProductId).toBe("330");
  });

  it("deduplicates identical retailer identities and prefers an available record", () => {
    const unavailable = { ...rimiProduct("old", "Sālsstandziņas Rimi 125g", "125g"), available: false };
    const available = { ...rimiProduct("new", "Sālsstandziņas Rimi 125g", "125g"), available: true };
    expect(dedupeExternalCatalogProducts([unavailable, available])).toEqual([available]);
  });
});
