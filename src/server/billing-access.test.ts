import { afterEach, describe, expect, it, vi } from "vitest";

const getSupabaseAdmin = vi.hoisted(() => vi.fn());
vi.mock("./supabase", () => ({ getSupabaseAdmin }));

import { readAccessStatus } from "./billing";

function databaseResult(expiresAt: string) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { scanner_entitlements: { status: "active", expires_at: expiresAt } },
    error: null
  });
  return { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) };
}

describe("billing access status", () => {
  afterEach(() => {
    vi.useRealTimers();
    getSupabaseAdmin.mockReset();
  });

  it("returns the authoritative expiry for active access", async () => {
    vi.setSystemTime(new Date("2026-09-08T12:00:00.000Z"));
    getSupabaseAdmin.mockReturnValue(databaseResult("2026-09-15T12:00:00.000Z"));
    await expect(readAccessStatus("a".repeat(64))).resolves.toEqual({
      active: true,
      expired: false,
      expiresAt: "2026-09-15T12:00:00.000Z"
    });
  });

  it("preserves an expired purchase so the client can show a repeat-purchase offer", async () => {
    vi.setSystemTime(new Date("2026-09-08T12:00:00.000Z"));
    getSupabaseAdmin.mockReturnValue(databaseResult("2026-09-08T11:59:59.000Z"));
    await expect(readAccessStatus("a".repeat(64))).resolves.toEqual({
      active: false,
      expired: true,
      expiresAt: "2026-09-08T11:59:59.000Z"
    });
  });
});
