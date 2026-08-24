import { afterEach, describe, expect, it } from "vitest";
import { getCatalog } from "@/lib/catalog";
import {
  DEFAULT_GEMINI_MODEL,
  fitBoxToFrame,
  isTrustedShelfPriceDetection,
  matchCatalogProduct,
  recognitionInstruction,
  recognitionConfidenceThreshold,
  recognizeProducts
} from "./recognition";

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
  });

  it("treats checkout as one multi-product frame through the same response shape", async () => {
    const result = await recognizeProducts({
      source: "sample-conveyor",
      sampleFrame: 7,
      catalog: getCatalog(),
      requestId: "request-checkout"
    });
    expect(result.status).toBe("matched");
    expect(result.detections).toHaveLength(4);
    expect(new Set(result.detections.map((detection) => detection.productId)).size).toBe(4);
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
  });

  it("keeps the uncertain retry focused on one centered package", () => {
    const instruction = recognitionInstruction(true);
    expect(instruction).toContain("center crop");
    expect(instruction).toContain("most prominent readable package");
    expect(instruction).not.toContain("complete frame from left to right and top to bottom");
  });
});

describe("isTrustedShelfPriceDetection", () => {
  const trusted = {
    shelfPriceCents: 169,
    shelfPriceText: "1,69 €",
    shelfPriceConfidence: 0.96,
    shelfPriceLabelVisible: true
  };

  it("requires a separate visible label, high confidence and matching currency text", () => {
    expect(isTrustedShelfPriceDetection(trusted)).toBe(true);
    expect(isTrustedShelfPriceDetection({ ...trusted, shelfPriceLabelVisible: false })).toBe(false);
    expect(isTrustedShelfPriceDetection({ ...trusted, shelfPriceConfidence: 0.89 })).toBe(false);
    expect(isTrustedShelfPriceDetection({ ...trusted, shelfPriceText: "1,69" })).toBe(false);
    expect(isTrustedShelfPriceDetection({ ...trusted, shelfPriceCents: 59 })).toBe(false);
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
