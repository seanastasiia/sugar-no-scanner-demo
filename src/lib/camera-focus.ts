import type { BoundingBox, ProductDetection, RecognitionResponse } from "./types";

type CameraCrop = BoundingBox;

export interface MediaDimensions {
  width: number;
  height: number;
}

export const CAMERA_FOCUS_CROP: CameraCrop = {
  x: 0.14,
  y: 0.16,
  width: 0.72,
  height: 0.7
};

export function remapBoxFromCrop(box: BoundingBox, crop: CameraCrop = CAMERA_FOCUS_CROP): BoundingBox {
  return {
    x: crop.x + box.x * crop.width,
    y: crop.y + box.y * crop.height,
    width: box.width * crop.width,
    height: box.height * crop.height
  };
}

export function remapRecognitionFromCrop(
  response: RecognitionResponse,
  crop: CameraCrop = CAMERA_FOCUS_CROP
): RecognitionResponse {
  return {
    ...response,
    detections: response.detections.map(
      (detection): ProductDetection => ({ ...detection, box: remapBoxFromCrop(detection.box, crop) })
    )
  };
}

/**
 * Maps model coordinates from the uncropped media into the visible rectangle
 * produced by CSS `object-fit: cover`. The returned values stay normalized to
 * the stage, which keeps overlay rendering responsive across iPhone sizes.
 */
export function mapBoxToObjectCover(
  box: BoundingBox,
  media: MediaDimensions,
  stage: MediaDimensions
): BoundingBox {
  if (media.width <= 0 || media.height <= 0 || stage.width <= 0 || stage.height <= 0) return box;

  const scale = Math.max(stage.width / media.width, stage.height / media.height);
  const renderedWidth = media.width * scale;
  const renderedHeight = media.height * scale;
  const offsetX = (stage.width - renderedWidth) / 2;
  const offsetY = (stage.height - renderedHeight) / 2;
  const rawLeft = offsetX + box.x * renderedWidth;
  const rawTop = offsetY + box.y * renderedHeight;
  const rawRight = rawLeft + box.width * renderedWidth;
  const rawBottom = rawTop + box.height * renderedHeight;
  const left = Math.max(0, Math.min(stage.width, rawLeft));
  const top = Math.max(0, Math.min(stage.height, rawTop));
  const right = Math.max(left, Math.min(stage.width, rawRight));
  const bottom = Math.max(top, Math.min(stage.height, rawBottom));

  return {
    x: left / stage.width,
    y: top / stage.height,
    width: (right - left) / stage.width,
    height: (bottom - top) / stage.height
  };
}

/**
 * Maps model coordinates into an `object-fit: contain` preview. Unlike cover,
 * contain keeps the complete camera frame visible and adds letterboxing when
 * the camera and phone screen use different aspect ratios.
 */
export function mapBoxToObjectContain(
  box: BoundingBox,
  media: MediaDimensions,
  stage: MediaDimensions
): BoundingBox {
  if (media.width <= 0 || media.height <= 0 || stage.width <= 0 || stage.height <= 0) return box;

  const scale = Math.min(stage.width / media.width, stage.height / media.height);
  const renderedWidth = media.width * scale;
  const renderedHeight = media.height * scale;
  const offsetX = (stage.width - renderedWidth) / 2;
  const offsetY = (stage.height - renderedHeight) / 2;

  return {
    x: (offsetX + box.x * renderedWidth) / stage.width,
    y: (offsetY + box.y * renderedHeight) / stage.height,
    width: (box.width * renderedWidth) / stage.width,
    height: (box.height * renderedHeight) / stage.height
  };
}
