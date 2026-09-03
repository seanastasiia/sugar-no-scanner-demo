import { describe, expect, it } from "vitest";
import { retryBoundaryElapsed, retryNotBefore, SOURCE_RETRY_FALLBACK_MS } from "./source-retry";

describe("durable source cooldown", () => {
  const now = Date.parse("2026-09-03T16:00:00Z");
  it("honours Retry-After seconds and future HTTP dates", () => {
    expect(retryNotBefore("120", now)).toBe("2026-09-03T16:02:00.000Z");
    expect(retryNotBefore("Thu, 03 Sep 2026 18:00:00 GMT", now)).toBe("2026-09-03T18:00:00.000Z");
  });
  it("uses a conservative fallback for absent, stale or malformed instructions", () => {
    expect(Date.parse(retryNotBefore(null, now)) - now).toBe(SOURCE_RETRY_FALLBACK_MS);
    expect(Date.parse(retryNotBefore("bad", now)) - now).toBe(SOURCE_RETRY_FALLBACK_MS);
    expect(Date.parse(retryNotBefore("Wed, 02 Sep 2026 18:00:00 GMT", now)) - now).toBe(SOURCE_RETRY_FALLBACK_MS);
  });
  it("does not resume before the saved boundary", () => {
    expect(retryBoundaryElapsed("2026-09-03T16:00:01Z", now)).toBe(false);
    expect(retryBoundaryElapsed("2026-09-03T16:00:00Z", now)).toBe(true);
  });
});
