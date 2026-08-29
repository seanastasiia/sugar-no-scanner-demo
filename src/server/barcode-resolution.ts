import type { ProductDetection, ScoredProduct } from "@/lib/types";
import { getExternalCatalogProductByBarcode } from "./external-catalog";
import { getOpenFoodFactsBulkProductByBarcode } from "./open-food-facts";

export interface BarcodeResolution {
  detection: ProductDetection;
  source: "catalog" | "retailer_catalog" | "open_food_facts";
}

export function resolveBarcodeFromKnownCatalogs(
  barcode: string,
  catalog: ScoredProduct[]
): BarcodeResolution | null {
  if (!/^\d{8,14}$/.test(barcode)) return null;
  const catalogProduct = catalog.find((product) => product.gtin === barcode);
  const external = catalogProduct ? null : getExternalCatalogProductByBarcode(barcode);
  const off = catalogProduct || external ? null : getOpenFoodFactsBulkProductByBarcode(barcode);
  const product = catalogProduct || external?.product || off;
  if (!product) return null;
  const source = catalogProduct ? "catalog" : external ? "retailer_catalog" : "open_food_facts";
  return {
    source,
    detection: {
      productId: product.id,
      catalogProductId: product.id,
      confidence: 1,
      box: { x: 0.08, y: 0.08, width: 0.84, height: 0.84 },
      observedText: `${product.brand} ${product.name}`,
      identity: {
        brand: product.brand,
        name: product.name,
        variant: null,
        packSize: product.packSizeG ? `${product.packSizeG}g` : null,
        category: product.category || null,
        matchKind: source === "catalog" ? "verified_catalog" : source,
        barcode
      },
      shelfPrice: null,
      retailerOffer: external?.offer || null,
      nutritionLinkConfidence: 1,
      inlineProduct: product
    }
  };
}
