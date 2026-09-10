import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("private billing return", () => {
  it("keeps only a bounded session ID and removes the referrer before rendering", () => {
    const response = GET(new Request("https://scanner.example/api/billing/return?session_id=cs_live_existing123&email=secret&next=https://other.example"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?checkout=success&session_id=cs_live_existing123");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.body).toBeNull();
  });
  it.each(["", "https://other.example", "cs_live_" + "a".repeat(161), "cs_live_token\\nheader"])("rejects invalid session %s", sessionId => {
    const response = GET(new Request(`https://scanner.example/api/billing/return?session_id=${encodeURIComponent(sessionId)}`));
    expect(response.headers.get("location")).toBe("/");
  });
});
