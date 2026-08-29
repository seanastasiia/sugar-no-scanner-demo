import { describe, expect, it } from "vitest";
import { getCatalog } from "@/lib/catalog";
import { resolveBarcodeFromKnownCatalogs } from "./barcode-resolution";

describe("barcode fast path", () => {
  it("returns an exact curated product without calling visual recognition", () => {
    const product = { ...getCatalog()[0], gtin: "12345678" };
    const result = resolveBarcodeFromKnownCatalogs("12345678", [product]);
    expect(result).toMatchObject({ source: "catalog", detection: { productId: product.id, confidence: 1 } });
    expect(result?.detection.inlineProduct?.id).toBe(product.id);
  });

  it("rejects malformed barcodes", () => {
    expect(resolveBarcodeFromKnownCatalogs("1234", getCatalog())).toBeNull();
  });
});
