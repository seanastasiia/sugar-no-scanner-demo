import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin, sendAmplitudeEvent } = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  sendAmplitudeEvent: vi.fn()
}));

vi.mock("@/server/amplitude", () => ({ sendAmplitudeEvent }));
vi.mock("@/server/supabase", () => ({ getSupabaseAdmin }));

import { POST } from "./route";

describe("POST /api/events", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sendAmplitudeEvent.mockReset();
    getSupabaseAdmin.mockReset();
    getSupabaseAdmin.mockReturnValue(null);
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

  it("stores external identities without violating the managed-product foreign key", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn((table: string) => {
      if (table === "scan_sessions") return { upsert, update };
      if (table === "scan_events") return { insert };
      throw new Error(`Unexpected table ${table}`);
    });
    getSupabaseAdmin.mockReturnValue({ from });
    sendAmplitudeEvent.mockResolvedValue("sent");

    const response = await POST(
      new Request("https://scanner.example/api/events", {
        method: "POST",
        headers: {
          origin: "https://scanner.example",
          "content-type": "application/json",
          "x-forwarded-for": crypto.randomUUID()
        },
        body: JSON.stringify({
          sessionId: "c6a590da-e68d-4f83-a725-c9e06b8d4bfa",
          name: "scan_completed",
          source: "sample-shelf",
          productId: "external:demo-product",
          metadata: { count: 4, latencyMs: 120 }
        })
      })
    );

    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: null,
        metadata: {
          count: 4,
          latencyMs: 120,
          observedProductId: "external:demo-product"
        }
      })
    );
    expect(sendAmplitudeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          count: 4,
          latencyMs: 120,
          observedProductId: "external:demo-product"
        }
      })
    );
  });

  it.each([false, true])("preserves scan IDs but forwards a stable browser visit (Supabase: %s)", async (stored) => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    if (stored) getSupabaseAdmin.mockReturnValue({
      from: (table: string) => table === "scan_sessions" ? { upsert } : { insert }
    });
    sendAmplitudeEvent.mockResolvedValue("sent");
    const browserSessionId = crypto.randomUUID();
    const scanIds = [crypto.randomUUID(), crypto.randomUUID()];
    for (const sessionId of scanIds) {
      const response = await POST(new Request("https://scanner.example/api/events", {
        method: "POST",
        headers: { origin: "https://scanner.example", "content-type": "application/json" },
        body: JSON.stringify({ sessionId, browserSessionId, name: "scan_started", source: "sample-shelf" })
      }));
      expect(response.status).toBe(200);
      expect(sendAmplitudeEvent).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId, browserSessionId }));
      if (stored) expect(insert).toHaveBeenLastCalledWith(expect.objectContaining({
        session_id: sessionId, metadata: { browserSessionId }
      }));
    }
  });

  it("rejects a non-UUID browser identity before storage or forwarding", async () => {
    const response = await POST(new Request("https://scanner.example/api/events", {
      method: "POST",
      headers: { origin: "https://scanner.example", "content-type": "application/json" },
      body: JSON.stringify({ sessionId: crypto.randomUUID(), browserSessionId: "someone@example.com", name: "app_opened", source: "camera" })
    }));
    expect(response.status).toBe(400);
    expect(sendAmplitudeEvent).not.toHaveBeenCalled();
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });
});
