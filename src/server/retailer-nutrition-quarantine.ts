import type { ExternalCatalogProduct } from "./external-catalog-types";

// Exact source tables rechecked on 2026-09-03. Keep the raw observations for
// audit, but require a reviewed source correction before restoring their Fit.
export const quarantinedRetailerNutrition = [
  {
    source: "livinn_lt",
    sourceProductId: "03000011074",
    sourceUrl: "https://www.livinn.lt/p/go-pure-ekologiski-bulviu-traskuciai-su-krapais-ir-laiskiniais-cesnakais-125-g-03000011074",
    reason: "Protein 57.8 g + carbohydrates 47 g + fat 29 g exceeds 100 g."
  },
  {
    source: "livinn_lt",
    sourceProductId: "1AM180309678",
    sourceUrl: "https://www.livinn.lt/p/baltym-batonelis-hazelnut-butter-dark-1am180309678-lt",
    reason: "Protein 24.6 g + carbohydrates 41.6 g + fat 35.5 g exceeds the 101 g consistency tolerance."
  }
] as const;

export function isQuarantinedRetailerNutrition(
  product: Pick<ExternalCatalogProduct, "source" | "sourceProductId">
): boolean {
  return quarantinedRetailerNutrition.some(
    (entry) => entry.source === product.source && entry.sourceProductId === product.sourceProductId
  );
}
