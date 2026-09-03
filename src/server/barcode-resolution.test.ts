import { describe, expect, it } from "vitest";
import { getCatalog } from "@/lib/catalog";
import { resolveBarcodeFromKnownCatalogs } from "./barcode-resolution";

describe("barcode fast path", () => {
  it("returns an exact curated product without calling visual recognition", () => {
    const product = { ...getCatalog()[0], gtin: "12345670" };
    const result = resolveBarcodeFromKnownCatalogs("12345670", [product]);
    expect(result).toMatchObject({ source: "catalog", detection: { productId: product.id, confidence: 1 } });
    expect(result?.detection.inlineProduct?.id).toBe(product.id);
  });

  it("rejects malformed barcodes", () => {
    expect(resolveBarcodeFromKnownCatalogs("1234", getCatalog())).toBeNull();
    expect(resolveBarcodeFromKnownCatalogs("12345678", getCatalog())).toBeNull();
  });

  it("does not treat a Livinn source product number as a barcode", () => {
    expect(resolveBarcodeFromKnownCatalogs("900414507757", getCatalog())).toBeNull();
  });
});
