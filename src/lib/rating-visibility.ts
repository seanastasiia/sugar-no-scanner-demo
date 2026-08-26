import type { ScoredProduct } from "./types";

export function hasSugarNoRating(product: ScoredProduct | undefined): product is ScoredProduct {
  return typeof product?.matchScore === "number";
}

export function ratedScanProductIds(
  ids: string[],
  productsById: Record<string, ScoredProduct | undefined>
): string[] {
  return ids.filter((id) => hasSugarNoRating(productsById[id]));
}

export function displayableScanProductIds(
  ids: string[],
  productsById: Record<string, ScoredProduct | undefined>,
  pendingIds: ReadonlySet<string>
): string[] {
  return ids.filter((id) => pendingIds.has(id) || hasSugarNoRating(productsById[id]));
}
