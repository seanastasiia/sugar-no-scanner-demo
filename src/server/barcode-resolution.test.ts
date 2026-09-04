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

  it.each(["100g", "100ml"] as const)("retains the %s package dimension on the expanded catalog path", (nutritionBasis) => {
    const product = { ...getCatalog()[0], gtin: "12345670", packSizeG: 250, nutritionBasis };
    const result = resolveBarcodeFromKnownCatalogs("12345670", [product]);
    expect(result?.detection.identity?.packSize).toBe(nutritionBasis === "100ml" ? "250ml" : "250g");
    expect(result?.detection.inlineProduct?.nutritionBasis).toBe(nutritionBasis);
  });

  it("does not treat a Livinn source product number as a barcode", () => {
    expect(resolveBarcodeFromKnownCatalogs("900414507757", getCatalog())).toBeNull();
  });
});
