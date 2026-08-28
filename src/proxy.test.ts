import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { proxy } from "./proxy";

const originalCode = process.env.DEMO_ACCESS_CODE;
const originalSecret = process.env.DEMO_SESSION_SECRET;

describe("private scanner proxy", () => {
  beforeEach(() => {
    process.env.DEMO_ACCESS_CODE = "test-code";
    process.env.DEMO_SESSION_SECRET = "test-secret";
  });
  afterEach(() => {
    process.env.DEMO_ACCESS_CODE = originalCode;
    process.env.DEMO_SESSION_SECRET = originalSecret;
  });

  it.each(["/access", "/api/auth", "/api/health"])(
    "keeps %s public",
    (pathname) => {
      const response = proxy(new NextRequest(`https://scanner.example${pathname}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  );

  it("redirects an unauthenticated page to access", () => {
    const response = proxy(new NextRequest("https://scanner.example/?scene=shelf"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://scanner.example/access?next=%2F%3Fscene%3Dshelf"
    );
  });

  it("rejects an unauthenticated API request without caching", async () => {
    const response = proxy(new NextRequest("https://scanner.example/api/recognize"));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Demo access required." });
  });

  it("allows a valid session cookie", () => {
    const token = createHash("sha256")
      .update("sugar-scanner:test-code:test-secret")
      .digest("hex");
    const request = new NextRequest("https://scanner.example/", {
      headers: { cookie: `sugar_scanner_access=${token}` }
    });
    const response = proxy(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
