import type { ProductDetection, ScoredProduct } from "@/lib/types";
import { getExternalCatalogIdentityByBarcode, getExternalCatalogProductByBarcode } from "./external-catalog";
import { getOpenFoodFactsBulkProductByBarcode } from "./open-food-facts";
import { findSharedWebProductByBarcode } from "./shared-web-catalog";
import { validWebGtin } from "./web-product-evidence";

export interface BarcodeResolution {
  detection: ProductDetection;
  source: "catalog" | "retailer_catalog" | "open_food_facts" | "web_search";
}

export async function resolveSharedWebBarcode(barcode: string): Promise<BarcodeResolution | null> {
  const product = await findSharedWebProductByBarcode(barcode);
  if (!product?.gtin) return null;
  const result = resolveBarcodeFromKnownCatalogs(product.gtin, [product]);
  if (!result) return null;
  return { source: "web_search", detection: { ...result.detection, catalogProductId: null,
    // Shared records do not yet retain a separately validated display quantity.
    identity: { ...result.detection.identity!, barcode, packSize: null, matchKind: "web_search" } } };
}

export function resolveBarcodeFromKnownCatalogs(
  barcode: string,
  catalog: ScoredProduct[]
): BarcodeResolution | null {
  const canonical = validWebGtin(barcode);
  if (!canonical) return null;
  const catalogProduct = catalog.find((product) => product.gtin === barcode || validWebGtin(product.gtin) === canonical);
  const external = catalogProduct ? null : getExternalCatalogProductByBarcode(barcode);
  const off = catalogProduct || external ? null : getOpenFoodFactsBulkProductByBarcode(barcode);
  const externalIdentity = catalogProduct || external || off ? null : getExternalCatalogIdentityByBarcode(barcode);
  const product = catalogProduct || external?.product || off || externalIdentity;
  if (!product) return null;
  const source = catalogProduct
    ? "catalog"
    : external || externalIdentity
      ? "retailer_catalog"
      : "open_food_facts";
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
        packSize: product.packSizeG ? `${product.packSizeG}${product.nutritionBasis === "100ml" ? "ml" : "g"}` : null,
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
