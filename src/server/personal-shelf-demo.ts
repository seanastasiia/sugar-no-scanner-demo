import type { ScoredProduct } from "@/lib/types";
import { getIndexedBarboraNutrition, indexedBarboraProductToScoredProduct } from "./barbora-nutrition-index";
import { getExternalCatalogProductById } from "./external-catalog";

/** A deliberately selected example, not a scan, representative sample or separate nutrition catalog. */
export const PERSONAL_SHELF_DEMO_IDS = [
  "livinn_lt:03000011072",
  "livinn_lt:03000011075",
  "livinn_lt:03000011074", // Real contradictory source: must remain unscored.
  "barbora:jog-skyr-islandes-bez-pied-400-g",
  "barbora:jogurts-baltais-salda-krej-ar-zem-400-g"
] as const;

/** Server-side only usage: serialize these five existing records, never the whole catalog. No I/O. */
export function personalShelfDemoProducts(): ScoredProduct[] {
  return PERSONAL_SHELF_DEMO_IDS.map((id) => {
    let product: ScoredProduct | null = null;
    if (id.startsWith("barbora:")) {
      const indexed = getIndexedBarboraNutrition(id.slice("barbora:".length));
      if (indexed) product = indexedBarboraProductToScoredProduct(indexed);
    } else {
      product = getExternalCatalogProductById(id);
    }
    // Fail the build if a refresh removes an example; never replace it with a similar SKU or made-up data.
    if (!product || product.shelfEvidence?.productId !== id) {
      throw new Error(`Exact rating demo product/evidence missing: ${id}`);
    }
    return product;
  });
}
