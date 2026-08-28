import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/events", () => {
  it("rejects a cross-origin browser request before analytics storage", async () => {
    const response = await POST(
      new Request("https://scanner.example/api/events", {
        method: "POST",
        headers: { origin: "https://attacker.example", "content-type": "application/json" },
        body: JSON.stringify({})
      })
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "untrusted_origin" });
  });
});
