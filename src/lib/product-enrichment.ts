import type { ProductDetection } from "@/lib/types";
import { mergeEnrichedDetections } from "@/lib/detection-merge";

export function mergeProgressiveEnrichment(
  currentDetections: ProductDetection[],
  requestedDetection: ProductDetection,
  resolvedDetection: ProductDetection | undefined
): ProductDetection[] {
  return currentDetections.map((current) =>
    current.productId === requestedDetection.productId
      ? mergeEnrichedDetections([current], resolvedDetection ? [resolvedDetection] : [])[0]
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
