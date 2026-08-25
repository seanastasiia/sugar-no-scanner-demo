import { describe, expect, it, vi } from "vitest";
import type { ScanSource } from "@/lib/types";
import { createRecognizePost } from "./route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://scanner.example/api/recognize", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
}

function matchedResponse(source: "camera" | "upload" | "sample-shelf" | "sample-conveyor") {
  return {
    requestId: "request-test",
    status: "matched" as const,
    detections: [],
    latencyMs: 1,
    model: source.startsWith("sample-") ? "sample" : "provider",
    imageStored: false as const
  };
}

describe("public recognition route", () => {
  it("serves a sample without a password cookie and never rate-limits samples", async () => {
    const recognize = vi.fn(async (input: { source: "camera" | "upload" | "sample-shelf" | "sample-conveyor" }) =>
      matchedResponse(input.source)
    );
    const post = createRecognizePost({
      listProducts: async () => [],
      recognize,
      limiter: { consume: () => ({ allowed: false, remaining: 0, retryAfterSeconds: 60 }) },
      requestId: () => "request-test"
    });
    const response = await post(request({ source: "sample-shelf" }));
    expect(response.status).toBe(200);
    expect(recognize).toHaveBeenCalledOnce();
    expect(await response.json()).toMatchObject({ status: "matched", imageStored: false });
  });

  it("returns 429 for live recognition above the public limit", async () => {
    const recognize = vi.fn();
    const post = createRecognizePost({
      listProducts: async () => [],
      recognize,
      limiter: { consume: () => ({ allowed: false, remaining: 0, retryAfterSeconds: 27 }) }
    });
    const response = await post(
      request({ source: "camera", imageDataUrl: "data:image/jpeg;base64,YWJj" })
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("27");
    expect(await response.json()).toEqual({ error: "rate_limited", retryAfterSeconds: 27 });
    expect(recognize).not.toHaveBeenCalled();
  });

  it("defers retailer resolution for live product frames but not uploads", async () => {
    const recognize = vi.fn(async (input: { source: ScanSource }) => matchedResponse(input.source));
    const post = createRecognizePost({
      listProducts: async () => [],
      recognize,
      limiter: { consume: () => ({ allowed: true, remaining: 20, retryAfterSeconds: 0 }) },
      requestId: () => "request-test"
    });
    await post(request({ source: "camera", imageDataUrl: "data:image/jpeg;base64,YWJj" }));
    await post(request({ source: "upload", imageDataUrl: "data:image/jpeg;base64,YWJj" }));
    expect(recognize).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ source: "camera", deferExternalResolution: true })
    );
    expect(recognize).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ source: "upload", deferExternalResolution: false })
    );
  });

  it("accepts a nutrition-label follow-up only with its recognized target identity", async () => {
    const recognize = vi.fn(async () => matchedResponse("camera"));
    const post = createRecognizePost({
      listProducts: async () => [],
      recognize,
      limiter: { consume: () => ({ allowed: true, remaining: 20, retryAfterSeconds: 0 }) },
      requestId: () => "request-test"
    });
    const missingTarget = await post(
      request({ source: "camera", mode: "nutrition-label", imageDataUrl: "data:image/jpeg;base64,YWJj" })
    );
    expect(missingTarget.status).toBe(400);

    const response = await post(
      request({
        source: "camera",
        mode: "nutrition-label",
        imageDataUrl: "data:image/jpeg;base64,YWJj",
        targetIdentity: {
          brand: "Sproud",
          name: "Barista 1L",
          variant: null,
          packSize: "1 L",
          category: "plant drink",
          matchKind: "visual_only"
        }
      })
    );
    expect(response.status).toBe(200);
    expect(recognize).toHaveBeenCalledWith(expect.objectContaining({ mode: "nutrition-label" }));
  });

  it("rejects declared oversized bodies before parsing", async () => {
    const post = createRecognizePost();
    const response = await post(request({}, { "content-length": "3000001" }));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "request_too_large" });
  });
});
