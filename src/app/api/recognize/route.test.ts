import { describe, expect, it, vi } from "vitest";
import type { ScanSource } from "@/lib/types";
import { hasTrustedBrowserOrigin } from "@/server/request-origin";
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
  it("accepts same-origin browser posts and non-browser benchmark clients", () => {
    expect(hasTrustedBrowserOrigin(request({}, { origin: "https://scanner.example" }))).toBe(true);
    expect(hasTrustedBrowserOrigin(request({}))).toBe(true);
    expect(
      hasTrustedBrowserOrigin(
        request({}, { "sec-fetch-site": "same-origin", referer: "https://scanner.example/" })
      )
    ).toBe(true);
  });

  it("rejects Chromium-style requests when fetch metadata or referer proves they are cross-site", () => {
    expect(hasTrustedBrowserOrigin(request({}, { "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(hasTrustedBrowserOrigin(request({}, { referer: "https://attacker.example/" }))).toBe(false);
  });

  it("rejects cross-origin browser posts before consuming Gemini capacity", async () => {
    const recognize = vi.fn();
    const post = createRecognizePost({ recognize });
    const response = await post(request({}, { origin: "https://attacker.example" }));
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "untrusted_origin" });
    expect(recognize).not.toHaveBeenCalled();
  });

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

  it("defers external resolution until the final camera or upload result", async () => {
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
      expect.objectContaining({ source: "upload", deferExternalResolution: true })
    );
  });

  it("rejects declared oversized bodies before parsing", async () => {
    const post = createRecognizePost();
    const response = await post(request({}, { "content-length": "3000001" }));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "request_too_large" });
  });
});
