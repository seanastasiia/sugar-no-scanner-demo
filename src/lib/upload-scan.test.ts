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
  it("uses one frame for focused/portrait photos and overlapping row crops for landscape shelves", () => {
    expect(uploadScanCrops(800, 1200)).toEqual([{ x: 0, y: 0, width: 1, height: 1 }]);
    expect(uploadScanCrops(1200, 800)).toEqual([
      { x: 0, y: 0, width: 1, height: 1 },
      { x: 0, y: 0, width: 1, height: 0.48 },
      { x: 0, y: 0.25, width: 1, height: 0.5 },
      { x: 0, y: 0.52, width: 1, height: 0.48 }
    ]);
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
});
