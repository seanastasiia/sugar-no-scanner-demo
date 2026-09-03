import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookup, page, productUrl } from "./__fixtures__/verified-web-product";

const { getSupabaseAdmin, generateContent, readLegacy, writeLegacy } = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(), generateContent: vi.fn(), readLegacy: vi.fn(), writeLegacy: vi.fn()
}));
vi.mock("./supabase", () => ({ getSupabaseAdmin }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { models = { generateContent }; }, ThinkingLevel: { LOW: "LOW" } }));
vi.mock("./web-nutrition-cache", () => ({ readPersistentWebNutrition: readLegacy, writePersistentWebNutrition: writeLegacy }));

function fakeDatabase() {
  const records = new Map<string, unknown>();
  const aliases = new Map<string, string>();
  const from = vi.fn((table: string) => {
    const filters = new Map<string, string>();
    const result = () => {
      if (table === "shared_web_product_aliases") {
        const id = aliases.get(filters.get("alias_key") || "");
        return { data: id ? { blocked: false, shared_web_products: { record: records.get(id), checked_at: new Date().toISOString() } } : null, error: null };
      }
      const id = filters.get("id");
      if (id) return { data: records.has(id) ? { record: records.get(id) } : null, error: null };
      const gtin = filters.get("record->>gtin");
      return { data: [...records.values()].filter((value) => (value as { gtin: string }).gtin === gtin).map((record) => ({ record })), error: null };
    };
    const chain = { select: vi.fn(() => chain), eq: vi.fn((key, value) => { filters.set(key, value); return chain; }),
      abortSignal: vi.fn(() => chain), limit: vi.fn(() => chain), maybeSingle: vi.fn(async () => result()),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve) };
    return chain;
  });
  const rpc = vi.fn((_name, params) => ({ abortSignal: async () => {
    records.set(params.p_record.id, params.p_record);
    aliases.set(params.p_alias_key, params.p_record.id);
    return { data: { status: "accepted", record: params.p_record }, error: null };
  } }));
  return { records, aliases, from, rpc };
}

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  vi.stubEnv("SHARED_WEB_CATALOG_ENABLED", "true");
  vi.stubEnv("GEMINI_API_KEY", "test-only");
  generateContent.mockResolvedValue({ text: "NUTRITION_JSON: " + JSON.stringify({ exactProductMatch: true, matchedBrand: "SELGA", matchedProductName: lookup.name,
    nutritionBasis: "100g", energyKcal: 900, proteinG: 90, totalSugarG: 99, carbohydrateG: null, confidence: 0.99, evidence: "Untrusted model text", sourceProductUrl: productUrl }),
    candidates: [{ groundingMetadata: { groundingChunks: [{ web: { uri: "https://grounding.example/redirect", title: "Product" } }] } }] });
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(page(), { headers: { "content-type": "text/html" } })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("shared web catalog end-to-end server flow", () => {
  it("promotes only actual page numbers and reuses the same card across a fresh server instance without Google", async () => {
    const db = fakeDatabase(); getSupabaseAdmin.mockReturnValue(db);
    const first = await (await import("./web-nutrition")).resolveWebNutritionProduct(lookup, 1);
    expect(first?.product.nutrientsPer100g).toMatchObject({ proteinG: 7.2, totalSugarG: 24, fiberG: null });
    expect(db.records.size).toBe(1);
    expect(db.aliases.size).toBe(1);
    vi.resetModules();
    const second = await (await import("./web-nutrition")).resolveWebNutritionProduct(lookup, 1);
    expect(second?.product.id).toBe(first?.product.id);
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(readLegacy).not.toHaveBeenCalled();
    expect(writeLegacy).not.toHaveBeenCalled();
    const { getSharedWebProduct, findSharedWebProductByBarcode } = await import("./shared-web-catalog");
    expect((await getSharedWebProduct(first!.product.id))?.id).toBe(first?.product.id);
    expect((await findSharedWebProductByBarcode("4006381333931"))?.id).toBe(first?.product.id);
    const { resolveSharedWebBarcode } = await import("./barcode-resolution");
    expect((await resolveSharedWebBarcode("4006381333931"))?.detection.identity?.matchKind).toBe("web_search");
  });
  it("saves a confirmed identity with missing nutrition as unrated, never model-provided nutrition", async () => {
    const db = fakeDatabase(); getSupabaseAdmin.mockReturnValue(db);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(page({}, ""), { headers: { "content-type": "text/html" } })));
    const result = await (await import("./web-nutrition")).resolveWebNutritionProduct(lookup, 1);
    expect(result?.product.ratingStatus).toBe("identity_only");
    expect(result?.product.matchScore).toBeNull();
    expect(result?.product.nutrientsPer100g.proteinG).toBeNull();
    expect(db.records.size).toBe(1);
  });
  it("keeps source failures and wrong variants out of both shared and legacy storage", async () => {
    const db = fakeDatabase(); getSupabaseAdmin.mockReturnValue(db);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(page({ name: "SELGA Chocolate biscuits 180 g" }), { headers: { "content-type": "text/html" } })));
    expect(await (await import("./web-nutrition")).resolveWebNutritionProduct(lookup, 1)).toBeNull();
    expect(db.rpc).not.toHaveBeenCalled();
    expect(writeLegacy).not.toHaveBeenCalled();
  });
  it("keeps enrichment unknown if a write cannot be confirmed, never bypassing a possible conflict decision", async () => {
    getSupabaseAdmin.mockReturnValue({ from() { throw new Error("offline"); }, rpc() { throw new Error("offline"); } });
    const result = await (await import("./web-nutrition")).resolveWebNutritionProduct(lookup, 1);
    expect(result).toBeNull();
    expect(writeLegacy).not.toHaveBeenCalled();
  });
  it("does not return a new claimed card after an identity-conflict decision", async () => {
    const db = fakeDatabase();
    db.rpc.mockImplementation(() => ({ abortSignal: async () => ({ data: { status: "conflict", record: undefined }, error: null }) }));
    getSupabaseAdmin.mockReturnValue(db);
    expect(await (await import("./web-nutrition")).resolveWebNutritionProduct(lookup, 1)).toBeNull();
  });
  it("does not enable writes by default or return arbitrary malformed stored records", async () => {
    const db = fakeDatabase(); getSupabaseAdmin.mockReturnValue(db);
    const { sharedRecordToProduct, promoteSharedWebProduct, getSharedWebProduct } = await import("./shared-web-catalog");
    expect(sharedRecordToProduct({ id: "forged", proteinG: 90 })).toBeNull();
    expect(await getSharedWebProduct("web:legacy-id")).toBeNull();
    vi.stubEnv("SHARED_WEB_CATALOG_ENABLED", "false");
    const { verifyWebProductPage } = await import("./web-product-evidence");
    expect((await promoteSharedWebProduct(lookup, verifyWebProductPage(lookup, page(), productUrl)!)).status).toBe("unavailable");
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
