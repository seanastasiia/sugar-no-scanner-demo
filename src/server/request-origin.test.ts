import { describe, expect, it } from "vitest";
import { hasTrustedBrowserOrigin } from "./request-origin";

function request(headers: Record<string, string> = {}) {
  return new Request("https://scanner.example/api/test", { method: "POST", headers });
}

describe("hasTrustedBrowserOrigin", () => {
  it("accepts same-origin Chromium and non-browser requests", () => {
    expect(hasTrustedBrowserOrigin(request({ origin: "https://scanner.example" }))).toBe(true);
    expect(
      hasTrustedBrowserOrigin(
        request({ "sec-fetch-site": "same-origin", referer: "https://scanner.example/scanner" })
      )
    ).toBe(true);
    expect(hasTrustedBrowserOrigin(request())).toBe(true);
  });

  it("rejects cross-site origin, fetch metadata and referer", () => {
    expect(hasTrustedBrowserOrigin(request({ origin: "https://attacker.example" }))).toBe(false);
    expect(hasTrustedBrowserOrigin(request({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(hasTrustedBrowserOrigin(request({ referer: "https://attacker.example/" }))).toBe(false);
  });

  it("accepts the public browser origin behind a reverse proxy", () => {
    const proxied = new Request("http://localhost:3000/api/test", {
      method: "POST",
      headers: {
        origin: "https://scanner.example",
        host: "localhost:3000",
        "x-forwarded-host": "scanner.example",
        "x-forwarded-proto": "https"
      }
    });
    expect(hasTrustedBrowserOrigin(proxied)).toBe(true);
  });
});
