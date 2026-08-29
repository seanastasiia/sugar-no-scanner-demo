import { describe, expect, it } from "vitest";
import { luminanceEdgeScore } from "./frame-quality";

function image(width: number, height: number, valueAt: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const value = valueAt(x, y);
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return data;
}

describe("camera frame quality", () => {
  it("rejects a flat blurred frame and accepts visible package-like edges", () => {
    expect(luminanceEdgeScore(image(8, 8, () => 120), 8, 8)).toBe(0);
    expect(luminanceEdgeScore(image(8, 8, (x) => (x % 2 ? 255 : 0)), 8, 8)).toBeGreaterThan(50);
  });

  it("fails closed for invalid dimensions", () => {
    expect(luminanceEdgeScore(new Uint8ClampedArray(), 0, 0)).toBe(0);
  });
});
