import { afterEach, describe, expect, it, vi } from "vitest";
import { getCatalog } from "@/lib/catalog";
import {
  DEFAULT_GEMINI_MODEL,
  applyBarboraCandidateConfirmations,
  needsVisualCandidateConfirmation,
  fitBoxToFrame,
  geminiBox2dToFrame,
  isTrustedShelfPriceDetection,
  matchCatalogProduct,
  recognitionInstruction,
  recognitionConfidenceThreshold,
  recognizeProducts,
  resolveVisibleDetections,
  type ProviderDetection
} from "./recognition";
import { resolveExternalCatalogProduct } from "./external-catalog";

const originalKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
});

describe("recognizeProducts", () => {
  it("returns the deterministic four-product shelf without storing an image", async () => {
    const result = await recognizeProducts({
      source: "sample-shelf",
      catalog: getCatalog(),
      requestId: "request-1"
    });
    expect(result.status).toBe("matched");
    expect(result.detections).toHaveLength(4);
    expect(result.detections.every((detection) => getCatalog().some((item) => item.id === detection.productId))).toBe(
      true
    );
    expect(result.imageStored).toBe(false);
    expect(result.model).toBe("deterministic-sample-v1");
    expect(result.detections[0]).toMatchObject({
      shelfPrice: { amount: 3.49, observedText: "Demo shelf price €3.49" },
      retailerOffer: {
        price: 2.79,
        exactSku: true,
        slug: "prot-bat-sal-riekst-saldin-barebells-55-g"
      }
    });
  });

  it("treats checkout as one multi-product frame through the same response shape", async () => {
    const result = await recognizeProducts({
      source: "sample-conveyor",
      sampleFrame: 7,
      catalog: getCatalog(),
      requestId: "request-checkout"
    });
    expect(result.status).toBe("matched");
    expect(result.detections).toHaveLength(3);
    expect(result.detections.map((detection) => detection.productId)).toEqual([
      "visual:sproud-barista-low-sugar-high-in-protein-drink-made-from-peas-1l",
      "visual:schnitzer-bio-burger-buns",
      "visual:stockmann-gailenes-chanterelles"
    ]);
    expect(result.detections.every((detection) => detection.identity?.matchKind === "visual_only")).toBe(true);
    expect(result.detections.map((detection) => detection.inlineProduct?.matchScore)).toEqual([100, 60, 100]);
    expect(result.detections.map((detection) => detection.inlineProduct?.ratingBasis)).toEqual([
      "manufacturer_reference",
      "manufacturer_reference",
      "food_composition_reference"
    ]);
    expect(result.detections.map((detection) => detection.inlineProduct?.nutrientsPer100g)).toEqual([
      { proteinG: 2.1, fiberG: null, totalSugarG: 1.8 },
      { proteinG: 3.4, fiberG: null, totalSugarG: 3.7 },
      { proteinG: 2, fiberG: null, totalSugarG: 0.4 }
    ]);
    expect(result.detections.every((detection) => detection.inlineProduct?.ratingStatus === "complete")).toBe(true);
    expect(result.imageStored).toBe(false);
  });

  it("fails closed when live recognition is not configured", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await recognizeProducts({
      source: "camera",
      imageDataUrl: "data:image/jpeg;base64,YWJj",
      catalog: getCatalog(),
      requestId: "request-2"
    });
    expect(result.status).toBe("provider_unavailable");
    expect(result.detections).toEqual([]);
    expect(result.imageStored).toBe(false);
    expect(result.model).toBe(DEFAULT_GEMINI_MODEL);
  });
});

describe("fitBoxToFrame", () => {
  it("prevents model boxes from overflowing the camera overlay", () => {
    const fitted = fitBoxToFrame({ x: 0.9, y: 0.8, width: 0.4, height: 0.5 });
    expect(fitted.x).toBe(0.9);
    expect(fitted.y).toBe(0.8);
    expect(fitted.width).toBeCloseTo(0.1);
    expect(fitted.height).toBeCloseTo(0.2);
  });
});

describe("recognitionConfidenceThreshold", () => {
  it("keeps the broad pass strict and allows a more sensitive focused retry", () => {
    expect(recognitionConfidenceThreshold(false, {})).toBe(0.72);
    expect(recognitionConfidenceThreshold(true, {})).toBe(0.58);
    expect(recognitionConfidenceThreshold(false, { RECOGNITION_CONFIDENCE_THRESHOLD: "0.8" })).toBe(0.8);
    expect(recognitionConfidenceThreshold(true, { FOCUSED_RECOGNITION_CONFIDENCE_THRESHOLD: "0.62" })).toBe(0.62);
  });

  it("falls back safely when configured values are invalid", () => {
    expect(recognitionConfidenceThreshold(false, { RECOGNITION_CONFIDENCE_THRESHOLD: "1.2" })).toBe(0.72);
    expect(recognitionConfidenceThreshold(true, { FOCUSED_RECOGNITION_CONFIDENCE_THRESHOLD: "invalid" })).toBe(
      0.58
    );
  });
});

describe("recognitionInstruction", () => {
  it("asks the broad pass to scan the whole shelf for several distinct SKUs", () => {
    const instruction = recognitionInstruction(false);
    expect(instruction).toContain("complete frame from left to right and top to bottom");
    expect(instruction).toContain("several different products on the same shelf");
    expect(instruction).toContain("Do not stop after the central or most prominent package");
    expect(instruction).toContain("Repeated facings of the same SKU are one product type");
    expect(instruction).toContain("no more than 10 boxes");
    expect(instruction).toContain("retailCategory as snack");
    expect(instruction).toContain("EAN-8, EAN-13 or UPC barcode");
    expect(instruction).toContain("box2d [ymin, xmin, ymax, xmax]");
    expect(instruction).toContain("excluding shelf labels, display trays, neighboring facings and empty space");
    expect(instruction).toContain("may omit the € symbol");
    expect(instruction).toContain("immediate shelf edge");
    expect(instruction).toContain("distant header or promotion labels");
  });

  it("keeps the uncertain retry focused on one centered package", () => {
    const instruction = recognitionInstruction(true);
    expect(instruction).toContain("center crop");
    expect(instruction).toContain("most prominent readable package");
    expect(instruction).not.toContain("complete frame from left to right and top to bottom");
  });

  it("treats a saved online-store screenshot as a list of product cards", () => {
    const instruction = recognitionInstruction(false, "saved-image");
    expect(instruction).toContain("long screenshot");
    expect(instruction).toContain("online grocery or catalog page");
    expect(instruction).toContain("every visible product card as a candidate SKU");
    expect(instruction).toContain("adjacent title, brand, variant and pack size");
    expect(instruction).toContain("not a physical shelf price label");
  });
});

describe("isTrustedShelfPriceDetection", () => {
  const trusted = {
    shelfPriceCents: 169,
    shelfPriceText: "1,69 €",
    shelfPriceConfidence: 0.96,
    shelfPriceLabelVisible: true
  };

  it("requires a separate visible label, high confidence and matching price text", () => {
    expect(isTrustedShelfPriceDetection(trusted)).toBe(true);
    expect(isTrustedShelfPriceDetection({ ...trusted, shelfPriceLabelVisible: false })).toBe(false);
    expect(isTrustedShelfPriceDetection({ ...trusted, shelfPriceConfidence: 0.89 })).toBe(false);
    expect(isTrustedShelfPriceDetection({ ...trusted, shelfPriceText: "1,69" })).toBe(true);
    expect(isTrustedShelfPriceDetection({ ...trusted, shelfPriceText: "169" })).toBe(false);
    expect(isTrustedShelfPriceDetection({ ...trusted, shelfPriceCents: 59 })).toBe(false);
  });
});

describe("geminiBox2dToFrame", () => {
  it("converts Gemini ymin/xmin/ymax/xmax coordinates into normalized CSS boxes", () => {
    expect(geminiBox2dToFrame([125, 250, 625, 750])).toEqual({
      x: 0.25,
      y: 0.125,
      width: 0.5,
      height: 0.5
    });
  });

  it("clamps inverted or out-of-order edges without creating negative boxes", () => {
    expect(geminiBox2dToFrame([800, 900, 200, 100])).toEqual({
      x: 0.9,
      y: 0.8,
      width: 0,
      height: 0
    });
  });
});

describe("matchCatalogProduct", () => {
  it("only assigns verified nutrition when brand and identity match the curated catalog", () => {
    const catalog = getCatalog();
    const saltyPeanut = catalog.find((product) => product.id === "prot-bat-sal-riekst-saldin-barebells-55-g")!;
    expect(
      matchCatalogProduct(
        {
          brand: saltyPeanut.brand,
          name: saltyPeanut.name,
          variant: "",
          packSize: "55 g",
          observedText: saltyPeanut.name
        },
        catalog
      )?.id
    ).toBe("prot-bat-sal-riekst-saldin-barebells-55-g");
    expect(
      matchCatalogProduct(
        {
          brand: "SANPELLEGRINO",
          name: "Zero sparkling drink",
          variant: "Pesca & Clementina",
          packSize: "330 ml",
          observedText: "Sanpellegrino Zero Pesca & Clementina"
        },
        catalog
      )
    ).toBeNull();
  });
});

function providerDetection(index: number, overrides: Partial<ProviderDetection> = {}): ProviderDetection {
  const label = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"][index - 1] || `Extra${index}`;
  return {
    brand: `Brand${label}`,
    productName: `Snack ${label} 50 g`,
    searchQuery: `Brand${label} Snack ${label} 50 g`,
    retailCategory: "snack",
    barcode: "",
    confidence: 0.9,
    box: { x: index / 10, y: 0.2, width: 0.08, height: 0.4 },
    shelfPriceCents: 0,
    shelfPriceText: "",
    shelfPriceConfidence: 0,
    shelfPriceLabelVisible: false,
    ...overrides
  };
}

describe("candidate confirmation", () => {
  const candidate = (slug: string) => ({
    slug,
    score: 0.78,
    title: `Product ${slug}`,
    brand: "SPILVA",
    packSize: "250g",
    imageUrl: null
  });

  it("accepts only a high-confidence slug from that detection's constrained candidate set", () => {
    const detections = [providerDetection(1), providerDetection(2)];
    const confirmed = applyBarboraCandidateConfirmations(
      detections,
      [
        { detectionIndex: 0, candidates: [candidate("allowed-a"), candidate("allowed-b")] },
        { detectionIndex: 1, candidates: [candidate("allowed-c"), candidate("allowed-d")] }
      ],
      [
        { detectionIndex: 0, candidateSlug: "allowed-b", confidence: 0.95, evidence: "Exact visible pack" },
        { detectionIndex: 1, candidateSlug: "invented", confidence: 0.99, evidence: "Not in candidates" },
        { detectionIndex: 1, candidateSlug: "allowed-c", confidence: 0.91, evidence: "Below threshold" }
      ]
    );

    expect(confirmed[0].confirmedBarboraSlug).toBe("allowed-b");
    expect(confirmed[1].confirmedBarboraSlug).toBeUndefined();
  });

  it("visually checks one plausible indexed candidate instead of discarding it below text-only exactness", () => {
    expect(
      needsVisualCandidateConfirmation(
        { detectionIndex: 0, candidates: [{ ...candidate("selga-caramel"), score: 0.58 }] },
        true
      )
    ).toBe(true);
    expect(
      needsVisualCandidateConfirmation({ detectionIndex: 0, candidates: [{ ...candidate("selga-caramel"), score: 0.58 }] })
    ).toBe(false);
    expect(
      needsVisualCandidateConfirmation({ detectionIndex: 0, candidates: [{ ...candidate("weak"), score: 0.51 }] }, true)
    ).toBe(false);
  });
});

describe("resolveVisibleDetections", () => {
  it("returns locally linked camera identities without waiting for retailer or Open Food Facts", async () => {
    const getOfferBySlug = vi.fn(async () => null);
    const resolveOffer = vi.fn(async () => null);
    const resolveOpenFoodFacts = vi.fn(async () => null);
    const detections = await resolveVisibleDetections(
      [providerDetection(1, { brand: "SPILVA", productName: "Siera majonēze 250 g" })],
      [],
      {
        getOfferBySlug,
        resolveOffer,
        resolveOpenFoodFacts,
        resolveIndexedCandidate: () => ({ slug: "majoneze-siera-spilva-250-g", score: 0.94 })
      },
      3,
      "fast"
    );

    expect(detections[0]).toMatchObject({
      productId: "barbora:majoneze-siera-spilva-250-g",
      nutritionLinkConfidence: 0.94,
      identity: { matchKind: "barbora" },
      retailerOffer: null
    });
    expect(getOfferBySlug).not.toHaveBeenCalled();
    expect(resolveOffer).not.toHaveBeenCalled();
    expect(resolveOpenFoodFacts).not.toHaveBeenCalled();
  });

  it("resolves up to ten identities with bounded concurrency", async () => {
    const attempted: string[] = [];
    let active = 0;
    let peak = 0;
    const detections = await resolveVisibleDetections(
      Array.from({ length: 8 }, (_, index) => providerDetection(index + 1)),
      [],
      {
        getOfferBySlug: async () => null,
        resolveOffer: async (input) => {
          attempted.push(input.name);
          active += 1;
          peak = Math.max(peak, active);
          await Promise.resolve();
          active -= 1;
          return null;
        },
        resolveOpenFoodFacts: async () => null
      },
      3
    );

    expect(attempted).toHaveLength(8);
    expect(attempted).toContain("Snack Five 50 g");
    expect(attempted).toContain("Snack Six 50 g");
    expect(peak).toBeLessThanOrEqual(3);
    expect(detections).toHaveLength(8);
  });

  it("deduplicates repeated facings after every facing receives the same resolution path", async () => {
    let attempts = 0;
    const detections = await resolveVisibleDetections(
      [
        providerDetection(1, {
          brand: "Coca-Cola",
          productName: "Coca-Cola Original Taste 330 ml",
          searchQuery: "Coca-Cola Original 330 ml"
        }),
        providerDetection(2, {
          brand: "Coca Cola",
          productName: "Coca Cola Original 330 ml",
          searchQuery: "Coca-Cola Original Taste 330 ml"
        })
      ],
      [],
      {
        getOfferBySlug: async () => null,
        resolveOffer: async () => {
          attempts += 1;
          return null;
        },
        resolveOpenFoodFacts: async () => null
      }
    );
    expect(attempts).toBe(2);
    expect(detections).toHaveLength(1);
  });

  it("uses an exact Open Food Facts result when Barbora cannot resolve the SKU", async () => {
    const fallback = getCatalog()[0];
    const detections = await resolveVisibleDetections(
      [providerDetection(1, { brand: "NICK'S", productName: "Soft Toffee protein bar 50 g" })],
      [],
      {
        getOfferBySlug: async () => null,
        resolveOffer: async () => null,
        resolveOpenFoodFacts: async () => ({ product: { ...fallback, id: "off:7350104401012" }, confidence: 0.93 })
      }
    );
    expect(detections[0]).toMatchObject({
      productId: "off:7350104401012",
      nutritionLinkConfidence: 0.93,
      identity: { matchKind: "open_food_facts" }
    });
  });

  it("uses an exact connected-retailer snapshot before Open Food Facts or web search", async () => {
    const product = {
      ...getCatalog()[0],
      id: "rimi_lv:100006",
      retailerProductId: "100006",
      ratingBasis: "retailer_catalog_reference" as const
    };
    const offer = {
      retailer: "Rimi" as const,
      slug: "rimi_lv:100006",
      title: "Mērce Santa Maria tako maigā 230g",
      brand: "Santa Maria",
      url: "https://www.rimi.lv/e-veikals/lv/produkti/example/p/100006",
      price: 2.27,
      currency: "EUR" as const,
      unitPrice: null,
      unit: null,
      imageUrl: null,
      checkedAt: "2026-08-26T00:00:00.000Z",
      matchConfidence: 0.96,
      exactSku: true
    };
    const resolveOpenFoodFacts = vi.fn(async () => null);
    const resolveWebNutrition = vi.fn(async () => null);
    const detections = await resolveVisibleDetections(
      [providerDetection(1, { brand: "Santa Maria", productName: "Tako mērce maigā 230g" })],
      [],
      {
        getOfferBySlug: async () => null,
        resolveOffer: async () => null,
        resolveExternalCatalog: () => ({ product, offer, confidence: 0.96 }),
        resolveOpenFoodFacts,
        resolveWebNutrition
      }
    );

    expect(detections[0]).toMatchObject({
      productId: "rimi_lv:100006",
      catalogProductId: null,
      nutritionLinkConfidence: 0.96,
      inlineProduct: { id: "rimi_lv:100006", ratingBasis: "retailer_catalog_reference" },
      identity: { matchKind: "retailer_catalog" },
      retailerOffer: { retailer: "Rimi", price: 2.27, exactSku: true }
    });
    expect(resolveOpenFoodFacts).not.toHaveBeenCalled();
    expect(resolveWebNutrition).not.toHaveBeenCalled();
  });

  it("resolves an English Rimi pack label from the Latvian snapshot without web search", async () => {
    const resolveOpenFoodFacts = vi.fn(async () => null);
    const resolveWebNutrition = vi.fn(async () => null);
    const detections = await resolveVisibleDetections(
      [
        providerDetection(1, {
          brand: "Rimi",
          productName: "Pastry twists SALTY 125g",
          searchQuery: "Rimi Pastry twists SALTY 125g"
        })
      ],
      [],
      {
        getOfferBySlug: async () => null,
        resolveOffer: async () => null,
        resolveExternalCatalog: resolveExternalCatalogProduct,
        resolveOpenFoodFacts,
        resolveIndexedCandidate: () => null,
        resolveWebNutrition
      }
    );

    expect(detections[0]).toMatchObject({
      productId: "rimi_lv:801291",
      nutritionLinkConfidence: 1,
      identity: { matchKind: "retailer_catalog" },
      inlineProduct: { id: "rimi_lv:801291", ratingBasis: "retailer_catalog_reference" }
    });
    expect(resolveOpenFoodFacts).not.toHaveBeenCalled();
    expect(resolveWebNutrition).not.toHaveBeenCalled();
  });

  it("uses a cited grounded web result only after catalog, Barbora and Open Food Facts miss", async () => {
    const fallback = { ...getCatalog()[0], id: "web:selga-classic", ratingBasis: "web_search_reference" as const };
    const resolveWebNutrition = vi.fn(async () => ({ product: fallback, confidence: 0.96 }));
    const detections = await resolveVisibleDetections(
      [providerDetection(1, { brand: "SELGA", productName: "Classic biscuits 180 g" })],
      [],
      {
        getOfferBySlug: async () => null,
        resolveOffer: async () => null,
        resolveOpenFoodFacts: async () => null,
        resolveIndexedCandidate: () => null,
        resolveWebNutrition
      }
    );

    expect(resolveWebNutrition).toHaveBeenCalledOnce();
    expect(detections[0]).toMatchObject({
      productId: "web:selga-classic",
      nutritionLinkConfidence: 0.96,
      inlineProduct: { ratingBasis: "web_search_reference" },
      identity: { matchKind: "web_search" }
    });
  });

  it("promotes an exact broad Barbora nutrition match outside the 40-product catalog", async () => {
    let openFoodFactsAttempts = 0;
    const indexedProduct = { ...getCatalog()[0], id: "barbora:majoneze-siera-spilva-250-g" };
    const detections = await resolveVisibleDetections(
      [providerDetection(1, { brand: "SPILVA", productName: "Siera majonēze 250 g" })],
      [],
      {
        getOfferBySlug: async () => null,
        resolveOffer: async () => ({
          retailer: "Barbora",
          slug: "majoneze-siera-spilva-250-g",
          title: "Majonēze SPILVA ar siera garšu 250g",
          brand: "SPILVA",
          url: "https://barbora.lv/produkti/majoneze-siera-spilva-250-g",
          price: 1.69,
          currency: "EUR",
          unitPrice: 6.76,
          unit: "kg",
          imageUrl: null,
          checkedAt: "2026-08-25T00:00:00.000Z",
          matchConfidence: 0.94,
          exactSku: true
        }),
        resolveIndexedCandidate: () => ({ slug: "majoneze-siera-spilva-250-g", score: 0.94 }),
        getIndexedProduct: () => ({ product: indexedProduct, alternatives: [] }),
        resolveOpenFoodFacts: async () => {
          openFoodFactsAttempts += 1;
          return null;
        }
      }
    );

    expect(detections[0]).toMatchObject({
      productId: "barbora:majoneze-siera-spilva-250-g",
      catalogProductId: "barbora:majoneze-siera-spilva-250-g",
      nutritionLinkConfidence: 0.94,
      identity: { matchKind: "barbora" },
      retailerOffer: null
    });
    expect(openFoodFactsAttempts).toBe(0);
  });

  it("keeps an exact broad nutrition match when the live retailer price page is unavailable", async () => {
    let openFoodFactsAttempts = 0;
    const indexedProduct = { ...getCatalog()[0], id: "barbora:kosl-gum-refresh-spearmint-orbit-15-6-g" };
    const detections = await resolveVisibleDetections(
      [providerDetection(1, { brand: "ORBIT", productName: "Refreshers Spearmint gum" })],
      [],
      {
        getOfferBySlug: async () => null,
        resolveOffer: async () => null,
        resolveIndexedCandidate: () => ({ slug: "kosl-gum-refresh-spearmint-orbit-15-6-g", score: 0.85 }),
        getIndexedProduct: () => ({ product: indexedProduct, alternatives: [] }),
        resolveOpenFoodFacts: async () => {
          openFoodFactsAttempts += 1;
          return null;
        }
      }
    );

    expect(detections[0]).toMatchObject({
      productId: "barbora:kosl-gum-refresh-spearmint-orbit-15-6-g",
      nutritionLinkConfidence: 0.85,
      identity: { matchKind: "barbora" },
      retailerOffer: null
    });
    expect(openFoodFactsAttempts).toBe(0);
  });
});
