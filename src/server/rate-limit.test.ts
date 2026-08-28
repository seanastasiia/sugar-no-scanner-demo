import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter, createRecognitionRateLimiter, recognitionClientKey } from "./rate-limit";

describe("FixedWindowRateLimiter", () => {
  it("is deterministic, rejects above the limit and resets after the window", () => {
    const limiter = new FixedWindowRateLimiter(2, 1_000);
    expect(limiter.consume("client", 0)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume("client", 100)).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.consume("client", 200)).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    expect(limiter.consume("client", 1_000)).toMatchObject({ allowed: true, remaining: 1 });
  });

  it("uses bounded defaults and a privacy-safe hashed client key", () => {
    const limiter = createRecognitionRateLimiter({ RECOGNITION_RATE_LIMIT: "1" });
    expect(limiter.consume("a", 0).allowed).toBe(true);
    expect(limiter.consume("a", 1).allowed).toBe(false);
    const request = new Request("https://scanner.example/api/recognize", {
      headers: { "x-forwarded-for": "203.0.113.8", "user-agent": "Test Agent" }
    });
    const key = recognitionClientKey(request);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("203.0.113.8");
    const rotatedUserAgent = recognitionClientKey(
      new Request("https://scanner.example/api/recognize", {
        headers: { "x-forwarded-for": "203.0.113.8", "user-agent": "Different Agent" }
      })
    );
    expect(rotatedUserAgent).toBe(key);
  });

  it("allows the 30-call camera cadence by default but remains bounded", () => {
    const limiter = createRecognitionRateLimiter({});
    for (let call = 1; call <= 30; call += 1) {
      expect(limiter.consume("camera", call * 1_900).allowed).toBe(true);
    }
    for (let call = 31; call <= 36; call += 1) {
      expect(limiter.consume("camera", 57_000 + (call - 30) * 100).allowed).toBe(true);
    }
    const rejected = limiter.consume("camera", 59_000);
    expect(rejected.allowed).toBe(false);
    expect(rejected.retryAfterSeconds).toBe(3);
  });

  it("honors a lower configured burst and rejects the next call", () => {
    const limiter = createRecognitionRateLimiter({
      RECOGNITION_RATE_LIMIT: "3",
      RECOGNITION_RATE_WINDOW_SECONDS: "60"
    });
    expect(limiter.consume("configured", 1_000).allowed).toBe(true);
    expect(limiter.consume("configured", 2_000).allowed).toBe(true);
    expect(limiter.consume("configured", 3_000).allowed).toBe(true);
    expect(limiter.consume("configured", 4_000)).toMatchObject({
      allowed: false,
      retryAfterSeconds: 57
    });
  });
});
