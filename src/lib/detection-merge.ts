import type { ProductDetection } from "./types";

function resolutionRank(detection: ProductDetection): number {
  if (detection.inlineProduct || detection.catalogProductId) return 3;
  if (detection.identity?.matchKind && detection.identity.matchKind !== "visual_only") return 2;
  return 1;
}

export function mergeEnrichedDetections(
  initialDetections: ProductDetection[],
  resolvedDetections: ProductDetection[]
): ProductDetection[] {
  return initialDetections.map((initial, index) => {
    const resolved = resolvedDetections[index];
    if (!resolved) return initial;
    const preferred = resolutionRank(resolved) >= resolutionRank(initial) ? resolved : initial;
    const mergedIdentity = preferred.identity
      ? {
          ...initial.identity,
          ...preferred.identity,
          variant: preferred.identity.variant || initial.identity?.variant || null,
          packSize: preferred.identity.packSize || initial.identity?.packSize || null,
          category: preferred.identity.category || initial.identity?.category || null
        }
      : initial.identity;
    return {
      ...initial,
      ...preferred,
      identity: mergedIdentity,
      shelfPrice: preferred.shelfPrice || initial.shelfPrice || null,
      retailerOffer: preferred.retailerOffer || initial.retailerOffer || null,
      inlineProduct: preferred.inlineProduct || initial.inlineProduct || null
    };
  });
}
