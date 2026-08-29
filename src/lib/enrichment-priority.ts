import type { ProductDetection } from "./types";

const knownMatchPriority: Record<NonNullable<ProductDetection["identity"]>["matchKind"], number> = {
  verified_catalog: 90,
  barbora: 85,
  retailer_catalog: 80,
  open_food_facts: 75,
  web_search: 60,
  visual_only: 0
};

export function enrichmentPriority(detection: ProductDetection): number {
  const identity = detection.identity;
  const boxArea = detection.box.width * detection.box.height;
  return (
    (identity?.barcode ? 120 : 0) +
    (identity ? knownMatchPriority[identity.matchKind] : 0) +
    (identity?.packSize ? 25 : 0) +
    (detection.catalogProductId ? 20 : 0) +
    detection.confidence * 10 +
    Math.min(5, boxArea * 20)
  );
}

export function prioritizeDetectionsForEnrichment(detections: ProductDetection[]): ProductDetection[] {
  return detections
    .map((detection, index) => ({ detection, index, priority: enrichmentPriority(detection) }))
    .sort((left, right) => right.priority - left.priority || left.index - right.index)
    .map(({ detection }) => detection);
}
