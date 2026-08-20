import { afterEach, describe, expect, it } from "vitest";
import { getCatalog } from "@/lib/catalog";
import {
  DEFAULT_GEMINI_MODEL,
  filterAllowedDetections,
  fitBoxToFrame,
  recognizeProducts
} from "./recognition";

const originalKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
});

describe("recognizeProducts", () => {
  it("returns the deterministic four-product shelf without storing an image", async () => {
    const result = await recognizeProducts({
      source: "sample-shelf",
      catalog: getCatalog(),
      requestId: "request-1"
    });
    expect(result.status).toBe("matched");
    expect(result.detections).toHaveLength(4);
    expect(result.detections.every((detection) => getCatalog().some((item) => item.id === detection.productId))).toBe(
      true
    );
    expect(result.imageStored).toBe(false);
    expect(result.model).toBe("deterministic-sample-v1");
  });

  it("treats checkout as one multi-product frame through the same response shape", async () => {
    const result = await recognizeProducts({
      source: "sample-conveyor",
      sampleFrame: 7,
      catalog: getCatalog(),
      requestId: "request-checkout"
    });
    expect(result.status).toBe("matched");
    expect(result.detections).toHaveLength(4);
    expect(new Set(result.detections.map((detection) => detection.productId)).size).toBe(4);
    expect(result.imageStored).toBe(false);
  });

  it("fails closed when live recognition is not configured", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await recognizeProducts({
      source: "camera",
      imageDataUrl: "data:image/jpeg;base64,YWJj",
      catalog: getCatalog(),
      requestId: "request-2"
    });
    expect(result.status).toBe("provider_unavailable");
    expect(result.detections).toEqual([]);
    expect(result.imageStored).toBe(false);
    expect(result.model).toBe(DEFAULT_GEMINI_MODEL);
  });
});

describe("fitBoxToFrame", () => {
  it("prevents model boxes from overflowing the camera overlay", () => {
    const fitted = fitBoxToFrame({ x: 0.9, y: 0.8, width: 0.4, height: 0.5 });
    expect(fitted.x).toBe(0.9);
    expect(fitted.y).toBe(0.8);
    expect(fitted.width).toBeCloseTo(0.1);
    expect(fitted.height).toBeCloseTo(0.2);
  });
});

describe("filterAllowedDetections", () => {
  it("keeps the server catalog as the authority when the provider returns an unknown ID", () => {
    const detections = filterAllowedDetections(
      [
        {
          productId: "unknown-product",
          confidence: 0.99,
          box: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 },
          observedText: "Invented product"
        },
        {
          productId: "known-product",
          confidence: 0.9,
          box: { x: 0.2, y: 0.2, width: 0.3, height: 0.3 },
          observedText: "Known product"
        }
      ],
      new Set(["known-product"]),
      0.82
    );

    expect(detections.map((detection) => detection.productId)).toEqual(["known-product"]);
  });
});
