import type { ProductDetection } from "@/lib/types";

function detectionResolutionRank(detection: ProductDetection): number {
  if (detection.inlineProduct || detection.catalogProductId) return 3;
  if (detection.identity?.matchKind && detection.identity.matchKind !== "visual_only") return 2;
  return 1;
}

function mergeEnrichedDetection(
  initial: ProductDetection,
  resolved: ProductDetection | undefined
): ProductDetection {
  if (!resolved) return initial;
  const preferred = detectionResolutionRank(resolved) >= detectionResolutionRank(initial) ? resolved : initial;
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
}

export function mergeEnrichedDetections(
  initialDetections: ProductDetection[],
  resolvedDetections: ProductDetection[]
): ProductDetection[] {
  return initialDetections.map((initial, index) => mergeEnrichedDetection(initial, resolvedDetections[index]));
}

export function mergeProgressiveEnrichment(
  currentDetections: ProductDetection[],
  requestedDetection: ProductDetection,
  resolvedDetection: ProductDetection | undefined
): ProductDetection[] {
  return currentDetections.map((current) =>
    current.productId === requestedDetection.productId
      ? mergeEnrichedDetection(current, resolvedDetection)
      : current
  );
}

export async function mapWithConcurrency<T>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), values.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < values.length) {
        const value = values[nextIndex++];
        await mapper(value);
      }
    })
  );
}
