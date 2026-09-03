import { describe, expect, it } from "vitest";
import { externalCatalogCounts, getExternalCatalogProductById } from "./external-catalog";
import { resolveBarcodeFromKnownCatalogs } from "./barcode-resolution";
import { isQuarantinedRetailerNutrition, quarantinedRetailerNutrition } from "./retailer-nutrition-quarantine";

describe("production Livinn nutrition quarantine", () => {
  it.each(quarantinedRetailerNutrition)("retains $sourceProductId without a fabricated Fit", (entry) => {
    const product = getExternalCatalogProductById(`${entry.source}:${entry.sourceProductId}`);
    expect(product).toMatchObject({
      id: `${entry.source}:${entry.sourceProductId}`,
      matchScore: null,
      ratingStatus: "identity_only",
      ratingSignalMask: [],
      nutrientsPer100g: { proteinG: null, totalSugarG: null, carbohydrateG: null }
    });
    expect(product?.name).toBeTruthy();
    expect(product?.sources[0].url).toBe(entry.sourceUrl);
    expect(resolveBarcodeFromKnownCatalogs(product!.gtin!, [])?.detection.inlineProduct?.matchScore).toBeNull();
  });

  it("keeps the verified Bett'r rice cakes rated", () => {
    const product = getExternalCatalogProductById("livinn_lt:1G1701009280");
    expect(product?.matchScore).not.toBeNull();
    expect(product?.nutrientsPer100g).toMatchObject({ proteinG: 8.1, totalSugarG: 1.8 });
  });

  it("reports only eligible nutrition records in runtime health counts", () => {
    expect(externalCatalogCounts().livinn_lt).toBe(1853);
  });

  it("does not quarantine another retailer using the same local ID", () => {
    expect(isQuarantinedRetailerNutrition({ source: "rimi_lv", sourceProductId: "03000011074" })).toBe(false);
  });
});
