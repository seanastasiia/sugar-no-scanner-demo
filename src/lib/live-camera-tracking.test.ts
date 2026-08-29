import { describe, expect, it } from "vitest";
import {
  estimateFrameTranslation,
  isSameCameraScene,
  proposeCameraCandidates,
  rgbaToLuma,
  translateDetection
} from "./live-camera-tracking";

function patternedFrame(width: number, height: number, dx = 0, dy = 0) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = x - dx;
      const sourceY = y - dy;
      const value = sourceX >= 0 && sourceY >= 0
        ? (sourceX * 17 + sourceY * 29 + ((sourceX >> 2) % 2) * 91) % 255
        : 0;
      const index = (y * width + x) * 4;
      rgba[index] = value;
      rgba[index + 1] = value;
      rgba[index + 2] = value;
      rgba[index + 3] = 255;
    }
  }
  return rgbaToLuma(rgba, width, height);
}

describe("live camera tracking", () => {
  it("estimates camera motion and keeps the same scene", () => {
    const translation = estimateFrameTranslation(patternedFrame(64, 48), patternedFrame(64, 48, 4, -2), 8);
    expect(translation).not.toBeNull();
    expect(translation?.dx).toBeCloseTo(4 / 64, 2);
    expect(translation?.dy).toBeCloseTo(-2 / 48, 2);
    expect(isSameCameraScene(translation)).toBe(true);
  });

  it("moves normalized detection boxes with the live preview", () => {
    const translated = translateDetection(
      {
        productId: "sku",
        confidence: 0.9,
        observedText: "SKU",
        box: { x: 0.2, y: 0.3, width: 0.2, height: 0.3 }
      },
      { dx: 0.1, dy: -0.05 }
    );
    expect(translated.box.x).toBeCloseTo(0.3);
    expect(translated.box.y).toBeCloseTo(0.25);
    expect(translated.box.width).toBe(0.2);
    expect(translated.box.height).toBe(0.3);
  });

  it("rejects a changed scene", () => {
    const reference = patternedFrame(64, 48);
    const changed = {
      ...reference,
      pixels: Uint8Array.from(reference.pixels, (value) => 255 - value)
    };
    expect(isSameCameraScene(estimateFrameTranslation(reference, changed, 8))).toBe(false);
  });

  it("proposes neutral regions before product identity is known", () => {
    const candidates = proposeCameraCandidates(patternedFrame(96, 72), 5);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(5);
    expect(candidates.every((box) => box.x >= 0 && box.y >= 0 && box.x + box.width <= 1.001)).toBe(true);
  });
});
