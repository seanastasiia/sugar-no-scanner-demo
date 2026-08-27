import { describe, expect, it } from "vitest";
import {
  CAMERA_FOCUS_CROP,
  mapBoxToObjectCover,
  mapBoxToObjectContain,
  remapBoxFromCrop,
  remapRecognitionFromCrop
} from "./camera-focus";

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

  it("aligns a landscape camera frame inside a portrait object-fit cover stage", () => {
    const mapped = mapBoxToObjectCover(
      { x: 0.4, y: 0.25, width: 0.2, height: 0.5 },
      { width: 1920, height: 1080 },
      { width: 375, height: 812 }
    );

    expect(mapped.x).toBeCloseTo(0.115, 2);
    expect(mapped.y).toBeCloseTo(0.25, 2);
    expect(mapped.width).toBeCloseTo(0.77, 2);
    expect(mapped.height).toBeCloseTo(0.5, 2);
  });

  it("clips boxes hidden by the object-fit cover crop", () => {
    const mapped = mapBoxToObjectCover(
      { x: 0.3, y: 0.2, width: 0.15, height: 0.4 },
      { width: 1920, height: 1080 },
      { width: 375, height: 812 }
    );

    expect(mapped.x).toBe(0);
    expect(mapped.width).toBeGreaterThan(0);
    expect(mapped.width).toBeLessThan(0.4);
  });

  it("leaves coordinates unchanged when media and stage share an aspect ratio", () => {
    const box = { x: 0.12, y: 0.18, width: 0.4, height: 0.5 };
    expect(mapBoxToObjectCover(box, { width: 750, height: 1624 }, { width: 375, height: 812 })).toEqual(box);
  });

  it("keeps a complete landscape camera frame visible inside a portrait stage", () => {
    const mapped = mapBoxToObjectContain(
      { x: 0.25, y: 0.2, width: 0.5, height: 0.4 },
      { width: 1920, height: 1080 },
      { width: 375, height: 812 }
    );

    expect(mapped.x).toBeCloseTo(0.25, 2);
    expect(mapped.y).toBeCloseTo(0.422, 2);
    expect(mapped.width).toBeCloseTo(0.5, 2);
    expect(mapped.height).toBeCloseTo(0.104, 2);
  });

  it("keeps coordinates unchanged for contain when aspect ratios match", () => {
    const box = { x: 0.12, y: 0.18, width: 0.4, height: 0.5 };
    expect(mapBoxToObjectContain(box, { width: 750, height: 1624 }, { width: 375, height: 812 })).toEqual(box);
  });
});
