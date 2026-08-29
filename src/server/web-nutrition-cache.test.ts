import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const cacheUpsert = vi.fn();
const historyUpsert = vi.fn();
const updateEq = vi.fn();
const update = vi.fn(() => ({ eq: updateEq }));
const from = vi.fn((table: string) => {
  if (table === "web_nutrition_cache_versions") return { upsert: historyUpsert };
  return {
    select: () => ({ eq: () => ({ maybeSingle }) }),
    upsert: cacheUpsert,
    update
  };
});

vi.mock("./supabase", () => ({ getSupabaseAdmin: () => ({ from }) }));

import { readPersistentWebNutrition, writePersistentWebNutrition } from "./web-nutrition-cache";

const verifiedResult = { product: { id: "web:item" }, confidence: 0.95 };

describe("persistent web nutrition cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: null, error: null });
    cacheUpsert.mockResolvedValue({ error: null });
    historyUpsert.mockResolvedValue({ error: null });
    updateEq.mockResolvedValue({ error: null });
  });

  it("returns a fresh exact cached result", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        cache_key: "brand|item",
        status: "success",
        result: verifiedResult,
        expires_at: "2026-09-28T00:00:00.000Z",
        revalidate_after: "2026-09-28T00:00:00.000Z"
      },
      error: null
    });
    const cached = await readPersistentWebNutrition("brand|item", new Date("2026-08-29T00:00:00.000Z"));
    expect(cached).toMatchObject({ result: verifiedResult, stale: false });
  });

  it("keeps a verified exact result after its revalidation date", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        cache_key: "brand|item",
        status: "success",
        result: verifiedResult,
        expires_at: "2026-08-28T23:59:59.000Z",
        revalidate_after: "2026-08-28T23:59:59.000Z"
      },
      error: null
    });
    const cached = await readPersistentWebNutrition("brand|item", new Date("2026-08-29T00:00:00.000Z"));
    expect(cached).toMatchObject({ result: verifiedResult, stale: true });
  });

  it("retries a stale miss because it has no verified nutrition", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        cache_key: "brand|missing",
        status: "miss",
        result: null,
        expires_at: "2026-08-28T23:59:59.000Z",
        revalidate_after: "2026-08-28T23:59:59.000Z"
      },
      error: null
    });
    await expect(
      readPersistentWebNutrition("brand|missing", new Date("2026-08-29T00:00:00.000Z"))
    ).resolves.toBeUndefined();
  });

  it("stores a verified current result and its immutable version", async () => {
    await writePersistentWebNutrition({
      cacheKey: "brand|item",
      brand: "Brand",
      name: "Item",
      result: verifiedResult as never,
      model: "gemini-test",
      revalidateAfter: Date.parse("2026-09-28T00:00:00.000Z")
    });
    expect(historyUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ cache_key: "brand|item", result: verifiedResult }),
      { onConflict: "cache_key,version_hash" }
    );
    expect(cacheUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        cache_key: "brand|item",
        status: "success",
        result: verifiedResult,
        revalidate_after: "2026-09-28T00:00:00.000Z"
      }),
      { onConflict: "cache_key" }
    );
  });

  it("does not replace a verified success when revalidation finds nothing", async () => {
    maybeSingle.mockResolvedValue({ data: { status: "success" }, error: null });
    await writePersistentWebNutrition({
      cacheKey: "brand|item",
      brand: "Brand",
      name: "Item",
      result: null,
      model: "gemini-test",
      revalidateAfter: Date.parse("2026-08-29T06:00:00.000Z"),
      preserveVerifiedSuccess: true
    });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ last_revalidation_error: expect.any(String) }));
    expect(cacheUpsert).not.toHaveBeenCalled();
  });

  it("fails open when Supabase is temporarily unavailable", async () => {
    maybeSingle.mockRejectedValue(new Error("network"));
    await expect(readPersistentWebNutrition("brand|item")).resolves.toBeUndefined();
  });
});
