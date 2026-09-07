import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureAttribution,
  FREE_REAL_SCANS,
  readFreeScanCount,
  readOrCreateAccessToken,
  recordFreeScan,
  WTP_ACCESS_TOKEN_KEY
} from "./wtp-access";

describe("WTP access storage", () => {
  beforeEach(() => localStorage.clear());

  it("keeps one anonymous access token on the device", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    expect(readOrCreateAccessToken(localStorage)).toBe("11111111-1111-4111-8111-111111111111");
    expect(readOrCreateAccessToken(localStorage)).toBe(localStorage.getItem(WTP_ACCESS_TOKEN_KEY));
    vi.unstubAllGlobals();
  });

  it("counts only up to the free real-scan allowance", () => {
    for (let index = 0; index < 8; index += 1) recordFreeScan(localStorage);
    expect(readFreeScanCount(localStorage)).toBe(FREE_REAL_SCANS);
  });

  it("captures bounded UTM values and keeps the first useful attribution", () => {
    expect(captureAttribution({ search: "?utm_source=meta&utm_campaign=riga-1&utm_content=video-a" }, localStorage))
      .toEqual({ utm_source: "meta", utm_campaign: "riga-1", utm_content: "video-a" });
    expect(captureAttribution({ search: "" }, localStorage)).toEqual({
      utm_source: "meta", utm_campaign: "riga-1", utm_content: "video-a"
    });
  });
});
