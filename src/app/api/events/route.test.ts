import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendAmplitudeEvent } = vi.hoisted(() => ({ sendAmplitudeEvent: vi.fn() }));

vi.mock("@/server/amplitude", () => ({ sendAmplitudeEvent }));
vi.mock("@/server/supabase", () => ({ getSupabaseAdmin: vi.fn(() => null) }));

import { POST } from "./route";

describe("POST /api/events", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sendAmplitudeEvent.mockReset();
  });

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

  it("keeps analytics delivery non-blocking when Amplitude is unavailable", async () => {
    sendAmplitudeEvent.mockResolvedValue("failed");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await POST(
      new Request("https://scanner.example/api/events", {
        method: "POST",
        headers: {
          origin: "https://scanner.example",
          "content-type": "application/json",
          "x-forwarded-for": crypto.randomUUID()
        },
        body: JSON.stringify({
          sessionId: "68e0202a-f167-4c69-bcb7-4fc02b163d21",
          name: "feedback_submitted",
          source: "camera",
          metadata: { helpful: true }
        })
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      storage: "structured_log",
      analytics: "failed"
    });
    expect(sendAmplitudeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "68e0202a-f167-4c69-bcb7-4fc02b163d21",
        name: "feedback_submitted",
        source: "camera",
        metadata: { helpful: true }
      })
    );
  });
});
