import { describe, expect, it } from "vitest";
import { thumbnailCrop } from "@/lib/thumbnail-crop";

describe("thumbnailCrop", () => {
  it("adds neighbouring context and preserves the requested pixel aspect ratio", () => {
    const crop = thumbnailCrop(
      { x: 0.32, y: 0.2, width: 0.12, height: 0.28 },
      { width: 1200, height: 900 },
      48 / 60
    );

    expect(crop.width).toBeGreaterThan(0.12);
    expect(crop.height).toBeGreaterThan(0.28);
    expect((crop.width * 1200) / (crop.height * 900)).toBeCloseTo(48 / 60, 5);
  });

  it("keeps edge detections inside the source image", () => {
    const crop = thumbnailCrop(
      { x: 0.91, y: 0.02, width: 0.09, height: 0.22 },
      { width: 1179, height: 2556 },
      42 / 54
    );

    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1);
    expect(crop.y + crop.height).toBeLessThanOrEqual(1);
  });
});

