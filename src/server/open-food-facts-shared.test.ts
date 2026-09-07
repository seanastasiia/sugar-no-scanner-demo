import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("./supabase", () => ({ getSupabaseAdmin }));

const requestedGtin = "4006381333931";
const canonicalGtin = "04006381333931";
const sourceProduct = {
  code: requestedGtin,
  product_name: "Classic Biscuits",
  product_name_ru: "Классическое печенье",
  brands: ["SELGA"],
  quantity: "180 g",
  nutrition_data_per: "100g",
  nutriments: {
    "energy-kcal_100g": 450,
    proteins_100g: 7.2,
    sugars_100g: 24,
    carbohydrates_100g: 70
  }
};

function fakeDatabase(promotionStatus: "accepted" | "conflict" = "accepted") {
  let stored: { gtin: string; record: unknown; checked_at: string; blocked: false } | null = null;
  const aliases = new Map<string, string>();
  const from = vi.fn((table: string) => {
    let filter = "";
    const result = () => ({
      data: table === "shared_open_food_facts_aliases"
        ? aliases.has(filter) ? { gtin: aliases.get(filter), blocked: false } : null
        : stored?.gtin === filter ? stored : null,
      error: null
    });
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn((_key: string, value: string) => { filter = value; return chain; }),
      abortSignal: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => result())
    };
    return chain;
  });
  const rpc = vi.fn((_name: string, params: { p_gtin: string; p_alias_key: string; p_record: unknown; p_checked_at: string }) => ({
    abortSignal: async () => {
      if (promotionStatus === "accepted") {
        stored = { gtin: params.p_gtin, record: params.p_record, checked_at: params.p_checked_at, blocked: false };
        if (params.p_alias_key) aliases.set(params.p_alias_key, params.p_gtin);
      }
      return { data: { status: promotionStatus }, error: null };
    }
  }));
  return { from, rpc, stored: () => stored };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("SHARED_OFF_CATALOG_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("dynamic Open Food Facts shared-card flow", () => {
  it("stores one exact API result and reuses it after a fresh server instance", async () => {
    const db = fakeDatabase();
    getSupabaseAdmin.mockReturnValue(db);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 1, product: sourceProduct }), {
      headers: { "content-type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await (await import("./open-food-facts")).getOpenFoodFactsProductByBarcode(requestedGtin);
    expect(first).toMatchObject({
      id: `off:${canonicalGtin}`,
      brand: "SELGA",
      name: "Классическое печенье",
      aliases: ["Classic Biscuits"],
      nutrientsPer100g: { proteinG: 7.2, totalSugarG: 24, carbohydrateG: 70 }
    });
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.stored()).toMatchObject({
      gtin: canonicalGtin,
      record: { code: canonicalGtin, product_name: "Classic Biscuits" }
    });

    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("OFF should not be called for a shared hit"); }));
    const second = await (await import("./open-food-facts")).getOpenFoodFactsProductByBarcode(requestedGtin);
    expect(second?.id).toBe(first?.id);
    expect(second?.nutrientsPer100g).toEqual(first?.nutrientsPer100g);
  });

  it("returns no card when the shared store reports a composition conflict", async () => {
    const db = fakeDatabase("conflict");
    getSupabaseAdmin.mockReturnValue(db);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: 1, product: sourceProduct }))));
    const result = await (await import("./open-food-facts")).getOpenFoodFactsProductByBarcode(requestedGtin);
    expect(result).toBeNull();
    expect(db.stored()).toBeNull();
  });

  it("rejects a mismatched barcode response before scoring or persistence", async () => {
    const db = fakeDatabase();
    getSupabaseAdmin.mockReturnValue(db);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      status: 1,
      product: { ...sourceProduct, code: "3017620422003" }
    }))));
    const result = await (await import("./open-food-facts")).getOpenFoodFactsProductByBarcode(requestedGtin);
    expect(result).toBeNull();
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("reuses a confirmed name-language alias without repeating OFF search", async () => {
    const db = fakeDatabase();
    getSupabaseAdmin.mockReturnValue(db);
    const input = {
      brand: "SELGA",
      name: "Classic Biscuits",
      variant: "",
      packSize: "180 g",
      searchTerms: ["SELGA Classic Biscuits 180 g"]
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ hits: [sourceProduct] }))));
    const first = await (await import("./open-food-facts")).resolveOpenFoodFactsProduct(input);
    expect(first?.product.id).toBe(`off:${canonicalGtin}`);
    expect(db.rpc).toHaveBeenCalledWith("promote_shared_open_food_facts_product", expect.objectContaining({
      p_gtin: canonicalGtin,
      p_alias_key: expect.stringMatching(/^off-v1:[a-f0-9]{64}$/)
    }));

    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("OFF search should not repeat for a shared alias"); }));
    const second = await (await import("./open-food-facts")).resolveOpenFoodFactsProduct(input);
    expect(second?.product.id).toBe(first?.product.id);
    expect(second?.confidence).toBe(0.99);
  });
});
