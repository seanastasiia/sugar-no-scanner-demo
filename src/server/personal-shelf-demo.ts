import type { ScoredProduct } from "@/lib/types";
import { getExternalCatalogProductById } from "./external-catalog";

/** A deliberately selected example, not a scan, representative sample or separate nutrition catalog. */
export const PERSONAL_SHELF_DEMO_IDS = [
  "livinn_lt:03000011072",
  "livinn_lt:03000011075",
  "livinn_lt:03000011074", // Real contradictory source: must remain unscored.
  "livinn_lt:1AM092400040" // Fiber absent: a real provisional 57–59 range.
] as const;

/** Server-side only usage: serialize these four existing records, never the whole catalog. No I/O. */
export function personalShelfDemoProducts(): ScoredProduct[] {
  return PERSONAL_SHELF_DEMO_IDS.map((id) => {
    const product = getExternalCatalogProductById(id);
    // Fail the build if a refresh removes an example; never replace it with a similar SKU or made-up data.
    if (!product || product.shelfEvidence?.productId !== id) {
      throw new Error(`Exact rating demo product/evidence missing: ${id}`);
    }
    return product;
  });
}
