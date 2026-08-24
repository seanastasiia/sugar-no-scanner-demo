import { describe, expect, it } from "vitest";
import { classifyUserAgent, metadataIsSafe } from "./event-privacy";

describe("metadataIsSafe", () => {
  it("allows bounded scan telemetry", () => {
    expect(metadataIsSafe({ latencyMs: 410, model: "sample-v1", minConfidence: 0.9 })).toBe(true);
  });

  it.each<Record<string, string | number | boolean | null>>([
    { imageDataUrl: "data:image/jpeg;base64,abc" },
    { rawFrame: "abc" },
    { ocrText: "product label" },
    { observedText: "visible package copy" },
    { note: "data:image/png;base64,abc" },
    { note: "x".repeat(501) }
  ])("rejects image-like or oversized metadata: %o", (metadata) => {
    expect(metadataIsSafe(metadata)).toBe(false);
  });
});

describe("classifyUserAgent", () => {
  it("stores only a coarse device class", () => {
    expect(classifyUserAgent("Mozilla/5.0 (iPhone) AppleWebKit Safari/604.1")).toBe("ios_safari");
    expect(classifyUserAgent("Mozilla/5.0 (Linux; Android 15) Chrome/130 Mobile")).toBe("android_chrome");
    expect(classifyUserAgent("Mozilla/5.0 (Macintosh) AppleWebKit Safari/605.1")).toBe("desktop");
  });
});
