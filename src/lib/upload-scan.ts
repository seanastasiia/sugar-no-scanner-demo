import { dedupeProductDetections } from "./product-detection-dedupe";
import type { BoundingBox, ProductDetection, RecognitionResponse } from "./types";

export type UploadScanCrop = BoundingBox;

export interface UploadScanResult {
  crop: UploadScanCrop;
  response: RecognitionResponse;
}

const fullFrame: UploadScanCrop = { x: 0, y: 0, width: 1, height: 1 };

export function uploadScanCrops(width: number, height: number): UploadScanCrop[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [fullFrame];
  if (width < height * 1.15) return [fullFrame];
  return [
    fullFrame,
    { x: 0, y: 0, width: 1, height: 0.48 },
    { x: 0, y: 0.25, width: 1, height: 0.5 },
    { x: 0, y: 0.52, width: 1, height: 0.48 }
  ];
}

export function remapUploadDetection(detection: ProductDetection, crop: UploadScanCrop): ProductDetection {
  return {
    ...detection,
    box: {
      x: crop.x + detection.box.x * crop.width,
      y: crop.y + detection.box.y * crop.height,
      width: detection.box.width * crop.width,
      height: detection.box.height * crop.height
    }
  };
}

function normalized(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => token.length >= 3 && !["classic", "klasika", "product"].includes(token));
}

function compactBrand(detection: ProductDetection): string {
  return normalized(detection.identity?.brand || "").join("");
}

function sourceBacked(detection: ProductDetection): boolean {
  return Boolean(
    detection.catalogProductId ||
      detection.inlineProduct ||
      (detection.identity && detection.identity.matchKind !== "visual_only")
  );
}

function overlapOverSmaller(left: BoundingBox, right: BoundingBox): number {
  const overlapWidth = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const overlapHeight = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  const smallerArea = Math.min(left.width * left.height, right.width * right.height);
  return smallerArea ? (overlapWidth * overlapHeight) / smallerArea : 0;
}

function relatedIdentity(left: ProductDetection, right: ProductDetection): boolean {
  if (!compactBrand(left) || compactBrand(left) !== compactBrand(right)) return false;
  const leftTokens = new Set(normalized(`${left.identity?.name || ""} ${left.observedText}`));
  const rightTokens = new Set(normalized(`${right.identity?.name || ""} ${right.observedText}`));
  return [...leftTokens].some((token) => rightTokens.has(token));
}

export function mergeUploadScanResults(results: UploadScanResult[], limit = 16): RecognitionResponse {
  const remapped = dedupeProductDetections(
    results.flatMap(({ crop, response }) => response.detections.map((detection) => remapUploadDetection(detection, crop)))
  );
  const withoutGenericDuplicates = remapped.filter((detection) => {
    if (sourceBacked(detection)) return true;
    return !remapped.some(
      (candidate) =>
        candidate !== detection &&
        sourceBacked(candidate) &&
        relatedIdentity(detection, candidate) &&
        overlapOverSmaller(detection.box, candidate.box) >= 0.5
    );
  });
  const selected = withoutGenericDuplicates
    .sort((left, right) => Number(sourceBacked(right)) - Number(sourceBacked(left)) || right.confidence - left.confidence)
    .slice(0, limit)
    .sort((left, right) => left.box.y - right.box.y || left.box.x - right.box.x);
  const first = results[0]?.response;
  return {
    requestId: first?.requestId || crypto.randomUUID(),
    status: selected.length ? "matched" : results.some(({ response }) => response.status === "provider_unavailable")
      ? "provider_unavailable"
      : "not_sure",
    detections: selected,
    latencyMs: Math.max(0, ...results.map(({ response }) => response.latencyMs)),
    model: [...new Set(results.map(({ response }) => response.model))].join(" + ") || "unknown",
    imageStored: false
  };
}
