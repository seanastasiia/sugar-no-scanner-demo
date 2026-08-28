import type { BoundingBox } from "@/lib/types";

export interface ImageDimensions {
  width: number;
  height: number;
}

const DEFAULT_NEIGHBORHOOD_SCALE = 1.6;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Expands a detected product box into an aspect-correct thumbnail crop.
 * The extra context deliberately keeps neighbouring packages visible instead
 * of stretching a tight detection box to fill a portrait thumbnail.
 */
export function thumbnailCrop(
  box: BoundingBox,
  source: ImageDimensions,
  targetAspect: number,
  neighborhoodScale = DEFAULT_NEIGHBORHOOD_SCALE
): BoundingBox {
  const sourceWidth = Math.max(1, source.width);
  const sourceHeight = Math.max(1, source.height);
  const safeAspect = Math.max(0.01, targetAspect);
  const safeScale = Math.max(1, neighborhoodScale);
  const boxWidth = clamp(box.width, 0.01, 1);
  const boxHeight = clamp(box.height, 0.01, 1);
  const normalizedTargetAspect = safeAspect / (sourceWidth / sourceHeight);

  let width = Math.max(boxWidth * safeScale, boxHeight * safeScale * normalizedTargetAspect);
  let height = width / normalizedTargetAspect;

  if (width > 1) {
    width = 1;
    height = width / normalizedTargetAspect;
  }
  if (height > 1) {
    height = 1;
    width = height * normalizedTargetAspect;
  }

  width = clamp(width, boxWidth, 1);
  height = clamp(height, boxHeight, 1);

  const centerX = clamp(box.x + boxWidth / 2, 0, 1);
  const centerY = clamp(box.y + boxHeight / 2, 0, 1);

  return {
    x: clamp(centerX - width / 2, 0, 1 - width),
    y: clamp(centerY - height / 2, 0, 1 - height),
    width,
    height
  };
}

