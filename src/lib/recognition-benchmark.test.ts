import { describe, expect, it } from "vitest";
import type { RecognitionResponse } from "@/lib/types";
import {
  aggregateRecognitionBenchmark,
  buildRecognitionRequestBody,
  detectBenchmarkImageMime,
  MAX_RECOGNITION_DATA_URL_CHARACTERS,
  summarizeRecognitionCase
} from "./recognition-benchmark";

describe("recognition benchmark privacy harness", () => {
  it("detects supported image formats from bytes rather than filenames", () => {
    expect(detectBenchmarkImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(detectBenchmarkImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      "image/png"
    );
    expect(detectBenchmarkImageMime(new TextEncoder().encode("RIFF1234WEBP"))).toBe("image/webp");
    expect(detectBenchmarkImageMime(new TextEncoder().encode("not-an-image"))).toBeNull();
  });

  it("builds the same bounded data-url request contract as the public route", () => {
    const body = buildRecognitionRequestBody(new Uint8Array([0xff, 0xd8, 0xff, 0x01]), "image/jpeg");
    expect(JSON.parse(body)).toEqual({ source: "upload", imageDataUrl: "data:image/jpeg;base64,/9j/AQ==" });
    const oversized = new Uint8Array(Math.ceil((MAX_RECOGNITION_DATA_URL_CHARACTERS * 3) / 4));
    expect(() => buildRecognitionRequestBody(oversized, "image/jpeg")).toThrow("image_too_large");
  });

  it("reports exact recall, rating coverage, de-duplication and the no-storage contract", () => {
    const response: RecognitionResponse = {
      requestId: "request-1",
      status: "matched",
      model: "gemini-test",
      latencyMs: 1200,
      imageStored: false,
      detections: [
        {
          productId: "known-a",
          confidence: 0.95,
          box: { x: 0, y: 0, width: 0.2, height: 0.4 },
          observedText: "Known A",
          identity: { brand: "A", name: "A", variant: null, packSize: null, category: null, matchKind: "verified_catalog" }
        },
        {
          productId: "visual:b",
          confidence: 0.8,
          box: { x: 0.3, y: 0, width: 0.2, height: 0.4 },
          observedText: "Visual B",
          identity: { brand: "B", name: "B", variant: null, packSize: null, category: null, matchKind: "visual_only" }
        }
      ]
    };
    const result = summarizeRecognitionCase({
      id: "case-01",
      httpStatus: 200,
      roundTripLatencyMs: 1400,
      response,
      expectedProductIds: ["known-a", "missing-c"],
      productDetails: new Map([
        ["known-a", { matchScore: 80, ratingStatus: "complete", ratingSignalCount: 3 }],
        ["visual:b", null]
      ])
    });
    expect(result.exactIdentityRecall).toBe(0.5);
    expect(result.ratedProductCount).toBe(1);
    expect(result.duplicateCount).toBe(0);
    expect(result.identityKinds).toEqual({ verified_catalog: 1, barbora: 0, visual_only: 1, unknown: 0 });
    expect(aggregateRecognitionBenchmark([result])).toMatchObject({
      exactIdentityRecall: 0.5,
      ratedCoverage: 0.5,
      duplicateRate: 0,
      imageStorageContractPassed: true
    });
  });
});
