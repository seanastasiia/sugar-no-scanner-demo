import { describe, expect, it } from "vitest";
import { CAMERA_FOCUS_CROP, remapBoxFromCrop, remapRecognitionFromCrop } from "./camera-focus";

describe("camera focus crop", () => {
  it("maps focused model boxes back into full camera coordinates", () => {
    const box = remapBoxFromCrop({ x: 0.25, y: 0.2, width: 0.5, height: 0.4 });

    expect(box.x).toBeCloseTo(0.32);
    expect(box.y).toBeCloseTo(0.3);
    expect(box.width).toBeCloseTo(0.36);
    expect(box.height).toBeCloseTo(0.28);
  });

  it("preserves response metadata while remapping detections", () => {
    const response = remapRecognitionFromCrop({
      requestId: "focused",
      status: "matched",
      detections: [
        {
          productId: "visual:rocket-bean",
          confidence: 0.68,
          box: { x: 0, y: 0, width: 1, height: 1 },
          observedText: "Rocket Bean"
        }
      ],
      latencyMs: 1200,
      model: "gemini-test",
      imageStored: false
    });

    expect(response.detections[0].box).toEqual(CAMERA_FOCUS_CROP);
    expect(response.requestId).toBe("focused");
    expect(response.imageStored).toBe(false);
  });
});
