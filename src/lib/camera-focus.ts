import type { BoundingBox, ProductDetection, RecognitionResponse } from "./types";

export type CameraCrop = BoundingBox;

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
