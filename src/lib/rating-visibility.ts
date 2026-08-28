import type { ProductDetection, ScoredProduct } from "./types";

const genericIdentityNames = new Set(["item", "product", "identified product", "unknown", "unknown product"]);

export function hasSugarNoRating(product: ScoredProduct | undefined): product is ScoredProduct {
  return typeof product?.matchScore === "number";
}

export function ratedScanProductIds(
  ids: string[],
  productsById: Record<string, ScoredProduct | undefined>
): string[] {
  return ids.filter((id) => hasSugarNoRating(productsById[id]));
}

export function hasRecognizedProductIdentity(detection: ProductDetection | undefined): boolean {
  const name = detection?.identity?.name.trim().toLocaleLowerCase();
  return Boolean(name && !genericIdentityNames.has(name));
}

export function displayableScanProductIds(
  ids: string[],
  productsById: Record<string, ScoredProduct | undefined>,
  pendingIds: ReadonlySet<string>,
  detectionsById: Record<string, ProductDetection | undefined> = {}
): string[] {
  return ids.filter(
    (id) => pendingIds.has(id) || hasSugarNoRating(productsById[id]) || hasRecognizedProductIdentity(detectionsById[id])
  );
}
