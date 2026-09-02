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

  it("returns an exact Livinn food identity without inventing missing nutrition", () => {
    const result = resolveBarcodeFromKnownCatalogs("900414507757", getCatalog());
    expect(result).toMatchObject({
      source: "retailer_catalog",
      detection: {
        productId: "livinn_lt:02000005925",
        identity: { matchKind: "retailer_catalog", barcode: "900414507757" },
        inlineProduct: {
          ratingStatus: "identity_only",
          matchScore: null,
          nutrientsPer100g: { proteinG: null, totalSugarG: null }
        }
      }
    });
  });
});
