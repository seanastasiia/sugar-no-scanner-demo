import type { ScoredProduct } from "./types";

export function hasSugarNoRating(product: ScoredProduct | undefined): product is ScoredProduct {
  return typeof product?.matchScore === "number";
}
