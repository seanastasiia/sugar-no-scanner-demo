import { describe, expect, it } from "vitest";
import type { ProductDetection, RecognitionResponse } from "./types";
import { mergeUploadScanResults, remapUploadDetection, uploadScanCrops } from "./upload-scan";

function detection(overrides: Partial<ProductDetection> = {}): ProductDetection {
  return {
    productId: "visual:selga-classic",
    confidence: 0.9,
    box: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    observedText: "Selga Classic",
    identity: {
      brand: "Selga",
      name: "Selga Classic",
      variant: null,
      packSize: null,
      category: null,
      matchKind: "visual_only"
    },
    ...overrides
  };
}

function response(detections: ProductDetection[]): RecognitionResponse {
  return {
    requestId: "upload-test",
    status: detections.length ? "matched" : "not_sure",
    detections,
    latencyMs: 100,
    model: "test",
    imageStored: false
  };
}

describe("multi-pass uploaded shelf recognition", () => {
  it("uses one frame for ordinary portraits and four passes for dense shelves or long screenshots", () => {
    expect(uploadScanCrops(800, 1200)).toEqual([{ x: 0, y: 0, width: 1, height: 1 }]);
    const fourPassLayout = [
      { x: 0, y: 0, width: 1, height: 1 },
      { x: 0, y: 0, width: 1, height: 0.48 },
      { x: 0, y: 0.25, width: 1, height: 0.5 },
      { x: 0, y: 0.52, width: 1, height: 0.48 }
    ];
    expect(uploadScanCrops(1200, 800)).toEqual(fourPassLayout);
    expect(uploadScanCrops(900, 2000)).toEqual(fourPassLayout);
  });

  it("maps a row-crop detection back onto the original photo", () => {
    expect(remapUploadDetection(detection(), { x: 0, y: 0.25, width: 1, height: 0.5 }).box).toEqual({
      x: 0.1,
      y: 0.35,
      width: 0.3,
      height: 0.2
    });
  });

  it("keeps the source-backed exact SKU and removes its overlapping broad visual duplicate", () => {
    const exact = detection({
      productId: "barbora:cepumi-selga-ar-sokolades-garsu-180-g",
      confidence: 0.96,
      observedText: "Selga Classic šokolādes garšu 180g",
      identity: {
        brand: "SELGA",
        name: "Selga Classic šokolādes garšu 180g",
        variant: null,
        packSize: "180g",
        category: null,
        matchKind: "barbora"
      }
    });
    const merged = mergeUploadScanResults([
      { crop: { x: 0, y: 0, width: 1, height: 1 }, response: response([detection()]) },
      { crop: { x: 0, y: 0, width: 1, height: 1 }, response: response([exact]) }
    ]);
    expect(merged.detections).toEqual([exact]);
  });

  it("merges duplicate cards across long-page sections while retaining distinct products", () => {
    const baltais = detection({
      productId: "barbora:biezp-krems-protein-baltais-persiku-300-g",
      catalogProductId: "barbora:biezp-krems-protein-baltais-persiku-300-g",
      confidence: 0.97,
      observedText: "Baltais Protein Fit peach 300g",
      identity: {
        brand: "Baltais",
        name: "Protein Fit peach 300g",
        variant: "Peach",
        packSize: "300g",
        category: "Dairy dessert",
        matchKind: "barbora"
      }
    });
    const stracciatella = detection({
      productId: "barbora:proteina-biezp-krems-vanil-baltais-200-g",
      catalogProductId: "barbora:proteina-biezp-krems-vanil-baltais-200-g",
      confidence: 0.95,
      observedText: "Baltais Protein Fit Stracciatella 200g",
      box: { x: 0.2, y: 0.3, width: 0.25, height: 0.3 },
      identity: {
        brand: "Baltais",
        name: "Protein Fit Stracciatella 200g",
        variant: "Stracciatella",
        packSize: "200g",
        category: "Dairy dessert",
        matchKind: "barbora"
      }
    });
    const junglePop = detection({
      productId: "visual:jungle-pop-kiwi-115-g",
      confidence: 0.91,
      observedText: "Jungle Pop kiwi 115g",
      box: { x: 0.4, y: 0.35, width: 0.3, height: 0.35 },
      identity: {
        brand: "Jungle Pop",
        name: "Jungle Pop kiwi 115g",
        variant: "Kiwi",
        packSize: "115g",
        category: "Jelly",
        matchKind: "visual_only"
      }
    });
    const merged = mergeUploadScanResults([
      { crop: { x: 0, y: 0, width: 1, height: 1 }, response: response([baltais]) },
      { crop: { x: 0, y: 0, width: 1, height: 0.48 }, response: response([baltais]) },
      { crop: { x: 0, y: 0.25, width: 1, height: 0.5 }, response: response([stracciatella]) },
      { crop: { x: 0, y: 0.52, width: 1, height: 0.48 }, response: response([junglePop]) }
    ]);

    expect(merged.detections.map((item) => item.productId)).toEqual([
      baltais.productId,
      stracciatella.productId,
      junglePop.productId
    ]);
  });

  it("keeps only the five highest-confidence distinct products from a dense photo", () => {
    const names = ["Almond", "Berry", "Coconut", "Date", "Espresso", "Fig", "Ginger", "Hazelnut"];
    const detections = Array.from({ length: 8 }, (_, index) =>
      detection({
        productId: `visual:product-${index + 1}`,
        confidence: 0.99 - index * 0.02,
        observedText: `${names[index]} snack`,
        box: { x: index * 0.1, y: 0.2, width: 0.08, height: 0.4 },
        identity: {
          brand: names[index],
          name: `${names[index]} snack`,
          variant: null,
          packSize: null,
          category: null,
          matchKind: "visual_only"
        }
      })
    );

    const merged = mergeUploadScanResults([
      { crop: { x: 0, y: 0, width: 1, height: 1 }, response: response(detections) }
    ]);

    expect(merged.detections).toHaveLength(5);
    expect(merged.detections.map((item) => item.productId)).toEqual(
      detections.slice(0, 5).map((item) => item.productId)
    );
  });
});
