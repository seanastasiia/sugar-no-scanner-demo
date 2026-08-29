import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const upsert = vi.fn();
const from = vi.fn(() => ({
  select: () => ({ eq: () => ({ gt: () => ({ maybeSingle }) }) }),
  upsert
}));

vi.mock("./supabase", () => ({ getSupabaseAdmin: () => ({ from }) }));

import { readPersistentWebNutrition, writePersistentWebNutrition } from "./web-nutrition-cache";

describe("persistent web nutrition cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a non-expired exact cached result", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        cache_key: "brand|item",
        status: "success",
        result: { product: { id: "web:item" }, confidence: 0.95 },
        expires_at: "2026-09-01T00:00:00.000Z"
      },
      error: null
    });
    const result = await readPersistentWebNutrition("brand|item", new Date("2026-08-29T00:00:00.000Z"));
    expect(result?.result?.confidence).toBe(0.95);
  });

  it("ignores an expired row even if the backend returns it", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        cache_key: "brand|item",
        status: "success",
        result: { product: { id: "web:item" }, confidence: 0.95 },
        expires_at: "2026-08-28T23:59:59.000Z"
      },
      error: null
    });
    await expect(
      readPersistentWebNutrition("brand|item", new Date("2026-08-29T00:00:00.000Z"))
    ).resolves.toBeUndefined();
  });

  it("stores misses as well as successes to avoid repeating slow searches", async () => {
    upsert.mockResolvedValue({ error: null });
    await writePersistentWebNutrition({
      cacheKey: "brand|missing",
      brand: "Brand",
      name: "Missing",
      result: null,
      model: "gemini-test",
      expiresAt: Date.parse("2026-09-01T00:00:00.000Z")
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ cache_key: "brand|missing", status: "miss", result: null }),
      { onConflict: "cache_key" }
    );
  });

  it("fails open when Supabase is temporarily unavailable", async () => {
    maybeSingle.mockRejectedValue(new Error("network"));
    await expect(readPersistentWebNutrition("brand|item")).resolves.toBeUndefined();
  });
});
