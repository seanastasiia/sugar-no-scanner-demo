import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/supabase", () => ({ getSupabaseAdmin: vi.fn(() => null) }));
vi.mock("@/server/feedback-email", () => ({ sendFeedbackEmail: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/server")>(),
  after: vi.fn()
}));

import { POST } from "./route";
import { after } from "next/server";
import { getSupabaseAdmin } from "@/server/supabase";
import { sendFeedbackEmail } from "@/server/feedback-email";

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
  beforeEach(() => {
    vi.mocked(after).mockReset();
    vi.mocked(sendFeedbackEmail).mockReset();
    vi.mocked(getSupabaseAdmin).mockReset().mockReturnValue(null);
  });
  afterEach(() => vi.restoreAllMocks());

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
    expect(after).not.toHaveBeenCalled();
  });

  function storage(sessionError: object | null = null, insertError: object | null = null) {
    const insert = vi.fn().mockResolvedValue({ error: insertError });
    const upsert = vi.fn().mockResolvedValue({ error: sessionError });
    const from = vi.fn((table: string) => table === "scan_sessions" ? { upsert } : { insert });
    vi.mocked(getSupabaseAdmin).mockReturnValue({ from } as unknown as NonNullable<ReturnType<typeof getSupabaseAdmin>>);
    return { insert, upsert };
  }

  it("schedules notification only after persistence and does not wait for mail", async () => {
    const { insert } = storage();
    const response = await POST(request(valid));
    expect(await response.json()).toEqual({ ok: true, storage: "supabase" });
    expect(after).toHaveBeenCalledOnce();
    expect(sendFeedbackEmail).not.toHaveBeenCalled();
    vi.mocked(sendFeedbackEmail).mockResolvedValue("failed");
    const callback = vi.mocked(after).mock.calls[0][0] as () => Promise<void>;
    await expect(callback()).resolves.toBeUndefined();
    expect(sendFeedbackEmail).toHaveBeenCalledWith(insert.mock.calls[0][0]);
    expect(response.status).toBe(200);
  });

  it.each(["session", "insert"]) ("does not send when %s storage fails", async (step) => {
    storage(step === "session" ? {} : null, step === "insert" ? {} : null);
    expect((await POST(request(valid))).status).toBe(503);
    expect(after).not.toHaveBeenCalled();
    expect(sendFeedbackEmail).not.toHaveBeenCalled();
  });

  it("does not schedule mail for invalid feedback", async () => {
    const { insert } = storage();
    expect((await POST(request({ ...valid, comment: "x".repeat(301) }))).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it("keeps success if background scheduling itself fails", async () => {
    storage();
    vi.mocked(after).mockImplementation(() => { throw new Error("unavailable"); });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await POST(request(valid));
    expect(await response.json()).toEqual({ ok: true, storage: "supabase" });
  });
});
