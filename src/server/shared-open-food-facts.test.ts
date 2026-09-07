import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("./supabase", () => ({ getSupabaseAdmin }));

const gtin = "04006381333931";
const record = {
  code: gtin,
  product_name: "Soft Toffee Protein Bar",
  brands: ["NICK'S"],
  quantity: "50 g",
  nutrition_data_per: "100g",
  nutriments: { "energy-kcal_100g": 360, proteins_100g: 30, sugars_100g: 3.2 }
};

function fakeDatabase(input: { stored?: unknown; alias?: unknown; promotionStatus?: string; readError?: unknown } = {}) {
  let table = "";
  const result = () => ({ data: table === "shared_open_food_facts_aliases" ? input.alias || null : input.stored || null, error: input.readError || null });
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    abortSignal: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result())
  };
  const from = vi.fn((name: string) => { table = name; return chain; });
  const rpc = vi.fn(() => ({
    abortSignal: async () => ({ data: { status: input.promotionStatus || "accepted" }, error: null })
  }));
  return { from, rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SHARED_OFF_CATALOG_ENABLED", "true");
});

afterEach(() => { vi.unstubAllEnvs(); });

describe("server-only shared Open Food Facts storage", () => {
  it("normalizes valid GTINs and rejects invalid checksums", async () => {
    const { canonicalSharedOffGtin } = await import("./shared-open-food-facts");
    expect(canonicalSharedOffGtin("4006381333931")).toBe(gtin);
    expect(canonicalSharedOffGtin(gtin)).toBe(gtin);
    expect(canonicalSharedOffGtin("4006381333932")).toBeNull();
    expect(canonicalSharedOffGtin("00000000")).toBeNull();
  });

  it("reads only an unblocked exact record", async () => {
    const db = fakeDatabase({ stored: { gtin, record, checked_at: "2026-09-07T12:00:00.000Z", blocked: false } });
    getSupabaseAdmin.mockReturnValue(db);
    const { readSharedOffRecord } = await import("./shared-open-food-facts");
    await expect(readSharedOffRecord("4006381333931")).resolves.toEqual({ gtin, record, checkedAt: "2026-09-07T12:00:00.000Z" });
    expect(db.from).toHaveBeenCalledWith("shared_open_food_facts_products");
  });

  it("reopens a shared record through an exact normalized language alias", async () => {
    const db = fakeDatabase({
      alias: { gtin, blocked: false },
      stored: { gtin, record, checked_at: "2026-09-07T12:00:00.000Z", blocked: false }
    });
    getSupabaseAdmin.mockReturnValue(db);
    const { readSharedOffRecordByAlias, sharedOffLookupKey } = await import("./shared-open-food-facts");
    const key = sharedOffLookupKey({ brand: " SELGA ", name: "Классическое печенье", variant: "", packSize: "180 G" });
    expect(key).toMatch(/^off-v1:[a-f0-9]{64}$/);
    expect(key).toBe(sharedOffLookupKey({ brand: "selga", name: "KLASSICHESKOE PECHENE", packSize: "180 g" }));
    await expect(readSharedOffRecordByAlias(key)).resolves.toEqual({ gtin, record, checkedAt: "2026-09-07T12:00:00.000Z" });
    expect(db.from).toHaveBeenNthCalledWith(1, "shared_open_food_facts_aliases");
    expect(db.from).toHaveBeenNthCalledWith(2, "shared_open_food_facts_products");
  });

  it("rejects malformed, mismatched and blocked stored data", async () => {
    const { readSharedOffRecord } = await import("./shared-open-food-facts");
    for (const stored of [
      { gtin, record: { ...record, code: "00000000000000" }, checked_at: "2026-09-07T12:00:00.000Z", blocked: false },
      { gtin, record, checked_at: "not-a-date", blocked: false },
      { gtin, record, checked_at: "2026-09-07T12:00:00.000Z", blocked: true }
    ]) {
      getSupabaseAdmin.mockReturnValue(fakeDatabase({ stored }));
      await expect(readSharedOffRecord(gtin)).resolves.toBeNull();
    }
  });

  it("promotes a bounded exact record and returns the database conflict decision", async () => {
    const db = fakeDatabase({ promotionStatus: "conflict" });
    getSupabaseAdmin.mockReturnValue(db);
    const { promoteSharedOffRecord } = await import("./shared-open-food-facts");
    await expect(promoteSharedOffRecord({
      gtin,
      record,
      checkedAt: "2026-09-07T12:00:00.000Z",
      identity: { gtin, brand: "nicks" },
      composition: { proteinG: 30, totalSugarG: 3.2 }
    })).resolves.toBe("conflict");
    expect(db.rpc).toHaveBeenCalledWith("promote_shared_open_food_facts_product", expect.objectContaining({ p_gtin: gtin, p_record: record }));
  });

  it("does nothing when disabled and fails closed on malformed input", async () => {
    const db = fakeDatabase();
    getSupabaseAdmin.mockReturnValue(db);
    const { promoteSharedOffRecord, readSharedOffRecord } = await import("./shared-open-food-facts");
    vi.stubEnv("SHARED_OFF_CATALOG_ENABLED", "false");
    await expect(readSharedOffRecord(gtin)).resolves.toBeNull();
    await expect(promoteSharedOffRecord({ gtin, record, checkedAt: "bad", identity: {}, composition: {} })).resolves.toBe("unavailable");
    expect(db.from).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
