import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/supabase", () => ({ getSupabaseAdmin: vi.fn(() => null) }));

import { POST } from "./route";

const valid = {
  sessionId: "66f9424f-0483-4c3a-ae78-31738729c41e",
  helpful: false,
  reason: "unclear",
  comment: "The product name was difficult to read.",
  context: "camera"
};

function request(body: unknown, origin = "https://scanner.example") {
  return new Request("https://scanner.example/api/feedback", {
    method: "POST",
    headers: { origin, "content-type": "application/json", "x-forwarded-for": crypto.randomUUID() },
    body: JSON.stringify(body)
  });
}

describe("POST /api/feedback", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("rejects cross-origin feedback", async () => {
    const response = await POST(request(valid, "https://attacker.example"));
    expect(response.status).toBe(403);
  });

  it("requires a reason for Needs work", async () => {
    const response = await POST(request({ ...valid, reason: null }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_feedback" });
  });

  it("rejects image-like content and overlong comments", async () => {
    expect((await POST(request({ ...valid, comment: "data:image/png;base64,abc" }))).status).toBe(400);
    expect((await POST(request({ ...valid, comment: "x".repeat(301) }))).status).toBe(400);
  });

  it("accepts a bounded anonymous response with structured-log fallback", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, storage: "structured_log" });
    expect(info).toHaveBeenCalledOnce();
  });
});
