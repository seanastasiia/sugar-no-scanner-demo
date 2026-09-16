import type { ProductDetection, ProductRecord } from "./types";
import { assessPersonalShelfProduct } from "./personal-shelf-rank";
import { validQueueBarcode, type ShelfQueueItem } from "./shelf-queue";

const textKey = (value: string | null | undefined) => (value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
// Only whitespace around an explicit quantity/unit is interchangeable; no inferred units or conversions.
const packKey = (value: string | null | undefined) => textKey(value).replace(/(\d)\s+(g|kg|ml|l)\b/g, "$1$2");
const barcodeKey = (value: string | null | undefined) => value && validQueueBarcode(value) ? value.padStart(14, "0") : null;

function matches(detection: ProductDetection, saved: ShelfQueueItem): boolean {
  const identity = detection.identity;
  const product = saved.result!;
  const seenBarcode = barcodeKey(identity?.barcode);
  const knownBarcode = barcodeKey(product.gtin);
  // A conflicting valid code wins over names and cached catalogue identifiers.
  if (seenBarcode && knownBarcode && seenBarcode !== knownBarcode) return false;
  if (identity?.variant && saved.lookup.variant && textKey(identity.variant) !== textKey(saved.lookup.variant)) return false;
  if (identity?.packSize && saved.lookup.packSize && packKey(identity.packSize) !== packKey(saved.lookup.packSize)) return false;
  if (seenBarcode && knownBarcode) return true;
  const knownIds = new Set([product.id, saved.lookup.productId].filter(Boolean));
  if (knownIds.has(detection.productId) || (detection.catalogProductId && knownIds.has(detection.catalogProductId))) return true;
  // Name-only recall requires all identifying fields, including an explicit pack size.
  return Boolean(identity?.brand && identity.name && identity.packSize && saved.lookup.packSize &&
    textKey(identity.brand) === textKey(saved.lookup.brand) && textKey(identity.name) === textKey(saved.lookup.name) &&
    textKey(identity.variant) === textKey(saved.lookup.variant) && packKey(identity.packSize) === packKey(saved.lookup.packSize));
}

/** Browser-owner-scoped verified results only. This does not guess an identity from a similar name. */
export function savedShelfMatches(detections: ProductDetection[], items: ShelfQueueItem[]): Record<string, ProductRecord> {
  const usable = items.filter(item => {
    if (item.status !== "ready" || !item.result) return false;
    const status = assessPersonalShelfProduct(item.result).status;
    return status === "scored" || status === "provisional";
  });
  const result: Record<string, ProductRecord> = {};
  for (const detection of detections) {
    if (detection.confidence < .78) continue;
    const candidates = usable.filter(item => matches(detection, item));
    if (!candidates.length) continue;
    // Never choose the last of two conflicting records just because of list order.
    if (new Set(candidates.map(item => JSON.stringify([item.result!.id, item.result!.shelfEvidence]))).size !== 1) continue;
    result[detection.productId] = candidates[0].result!;
  }
  return result;
}
