import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const originalCode = process.env.DEMO_ACCESS_CODE;
const originalSecret = process.env.DEMO_SESSION_SECRET;

function request(code: string, origin = "https://scanner.example") {
  return new NextRequest("https://scanner.example/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ code })
  });
}

describe("POST /api/auth", () => {
  beforeEach(() => {
    process.env.DEMO_ACCESS_CODE = "test-code";
    process.env.DEMO_SESSION_SECRET = "test-secret";
  });
  afterEach(() => {
    process.env.DEMO_ACCESS_CODE = originalCode;
    process.env.DEMO_SESSION_SECRET = originalSecret;
  });

  it("rejects cross-origin attempts", async () => {
    const response = await POST(request("test-code", "https://attacker.example"));
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects an invalid code", async () => {
    expect((await POST(request("wrong-code"))).status).toBe(401);
  });
  it("sets a protected session cookie for a valid code", async () => {
    const response = await POST(request("test-code"));
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(response.status).toBe(200);
    expect(cookie).toContain("sugar_scanner_access=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie.toLowerCase()).toContain("samesite=strict");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
