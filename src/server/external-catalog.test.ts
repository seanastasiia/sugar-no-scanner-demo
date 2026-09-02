import { describe, expect, it } from "vitest";
import {
  dedupeExternalCatalogProducts,
  externalCatalogIdentityToScoredProduct,
  externalCatalogToScoredProduct,
  rankExternalCatalogCandidates,
  rankExternalCatalogIdentities,
  resolveExternalCatalogProduct
} from "./external-catalog";
import type { ExternalCatalogIdentity, ExternalCatalogProduct } from "./external-catalog-types";

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

  it("matches a Livinn SKU through its source-provided Russian language alias", () => {
    const livinn: ExternalCatalogProduct = {
      ...product,
      source: "livinn_lt",
      sourceProductId: "1G1701009280",
      retailer: "Livin",
      url: "https://www.livinn.lt/p/eko-ryziu-trap-su-him-druska-bettr-120g-1g1701009280-lt",
      title: "Ryžių trapučiai su Himalajų druska, ekologiški",
      aliases: ["bett r risovye krekery s gimalaiskoi soliu organicheskie"],
      brand: "Bett'r",
      gtin: "380023368242",
      sku: "1G1701009280",
      category: "Maistas > Duona, bandelės, trapučiai",
      packSize: "120g",
      proteinG: 8.1,
      totalSugarG: 1.8,
      carbohydrateG: 75
    };
    const ranked = rankExternalCatalogCandidates(
      {
        brand: "BETT'R",
        name: "Рисовые крекеры с гималайской солью",
        variant: "",
        packSize: "120 г",
        searchTerms: []
      },
      [livinn]
    );
    expect(ranked[0]?.product.sourceProductId).toBe("1G1701009280");
    expect(ranked[0]?.confidence).toBeGreaterThanOrEqual(0.84);
    expect(externalCatalogToScoredProduct(livinn).aliases).toContain(
      "bett r risovye krekery s gimalaiskoi soliu organicheskie"
    );
  });

  it("matches an English Livinn label to the same Baltic SKU without translated nutrition guesses", () => {
    const livinn: ExternalCatalogIdentity = {
      source: "livinn_lt",
      sourceProductId: "1G1701009280",
      retailer: "Livin",
      url: "https://www.livinn.lt/p/eko-ryziu-trap-su-him-druska-bettr-120g-1g1701009280-lt",
      title: "Ryžių trapučiai su Himalajų druska, ekologiški",
      aliases: [
        "bett r risu galetes ar himalaju sali ekologiskas",
        "bett r risovye krekery s gimalaiskoi soliu organicheskie"
      ],
      brand: "Bett'r",
      gtin: "380023368242",
      sku: "1G1701009280",
      category: "Maistas > Duona, bandelės, trapučiai",
      packSize: "120g",
      imageUrl: null,
      price: 2.49,
      currency: "EUR",
      available: true,
      checkedAt: "2026-09-02T00:00:00.000Z"
    };
    const ranked = rankExternalCatalogIdentities(
      {
        brand: "BETT'R",
        name: "Brown Rice Cakes Himalayan Salt",
        variant: "",
        packSize: "120 g",
        searchTerms: []
      },
      [livinn]
    );
    const scored = externalCatalogIdentityToScoredProduct(livinn);

    expect(ranked[0]?.product.sourceProductId).toBe("1G1701009280");
    expect(ranked[0]?.confidence).toBeGreaterThanOrEqual(0.84);
    expect(scored.id).toBe("livinn_lt:1G1701009280");
    expect(scored.ratingStatus).toBe("identity_only");
    expect(scored.matchScore).toBeNull();
    expect(scored.nutrientsPer100g).toEqual({
      proteinG: null,
      fiberG: null,
      totalSugarG: null,
      carbohydrateG: null
    });
  });

  it("preserves decimal packs instead of treating 0,33 l as 33 litres", () => {
    const candidate = rimiProduct("330", "Dzēriens Rimi apelsīnu 330ml", "330ml");
    const ranked = rankExternalCatalogCandidates(
      { brand: "Rimi", name: candidate.title, variant: "", packSize: "0,33 l", searchTerms: [] },
      [candidate]
    );
    expect(ranked[0]?.product.sourceProductId).toBe("330");
  });

  it.each([
    ["BETT'R", "Brown Rice Cakes Himalayan Salt", "120 g", "1G1701009280", 8.1, 1.8],
    ["Valledoro", "Сухарики с оливковым маслом", "100 г", "1AM092401277", 12, 2],
    ["Sottolestelle", "Gluten Free Tarallini Rosemary", "150 g", "SOTT0299", 3.4, 1.5]
  ])("resolves the generated multilingual Livinn snapshot for %s", (brand, name, packSize, id, protein, sugar) => {
    const resolved = resolveExternalCatalogProduct(
      { brand, name, variant: "", packSize, searchTerms: [name] },
      ""
    );
    expect(resolved).toMatchObject({
      product: {
        id: `livinn_lt:${id}`,
        nutrientsPer100g: { proteinG: protein, totalSugarG: sugar }
      }
    });
  });

  it("deduplicates identical retailer identities and prefers an available record", () => {
    const unavailable = { ...rimiProduct("old", "Sālsstandziņas Rimi 125g", "125g"), available: false };
    const available = { ...rimiProduct("new", "Sālsstandziņas Rimi 125g", "125g"), available: true };
    expect(dedupeExternalCatalogProducts([unavailable, available])).toEqual([available]);
  });
});
