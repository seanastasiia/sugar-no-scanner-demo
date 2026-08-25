import catalogData from "../../data/catalog.generated.json";
import { rankSimilarProducts, scoreCatalog } from "./scoring";
import type { ProductRecord, ScoredProduct } from "./types";

const catalog = scoreCatalog(catalogData as ProductRecord[]);

export function getCatalog(): ScoredProduct[] {
  return catalog;
}

function getProductById(id: string): ScoredProduct | null {
  return catalog.find((product) => product.id === id) ?? null;
}

export function getProductWithAlternatives(id: string) {
  const product = getProductById(id);
  if (!product) return null;
  return {
    product,
    alternatives: rankSimilarProducts(product, catalog)
  };
}
