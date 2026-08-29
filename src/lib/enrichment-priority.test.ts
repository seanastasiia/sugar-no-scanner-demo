import { describe, expect, it } from "vitest";
import type { ProductDetection } from "./types";
import { prioritizeDetectionsForEnrichment } from "./enrichment-priority";

function detection(id: string, matchKind: NonNullable<ProductDetection["identity"]>["matchKind"], barcode: string | null = null): ProductDetection {
  return {
    productId: id,
    confidence: 0.9,
    box: { x: 0, y: 0, width: 0.2, height: 0.2 },
    observedText: id,
    identity: { brand: "Brand", name: id, variant: null, packSize: null, category: null, matchKind, barcode }
  };
}

describe("enrichment priority", () => {
  it("resolves exact barcode and catalog matches before web-only identities", () => {
    const result = prioritizeDetectionsForEnrichment([
      detection("web", "visual_only"),
      detection("catalog", "verified_catalog"),
      detection("barcode", "visual_only", "12345678")
    ]);
    expect(result.map((item) => item.productId)).toEqual(["barcode", "catalog", "web"]);
  });

  it("keeps the original order for equal-priority detections", () => {
    const result = prioritizeDetectionsForEnrichment([
      detection("first", "visual_only"),
      detection("second", "visual_only")
    ]);
    expect(result.map((item) => item.productId)).toEqual(["first", "second"]);
  });
});
