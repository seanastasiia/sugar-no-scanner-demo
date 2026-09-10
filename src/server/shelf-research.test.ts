import { beforeEach, describe, expect, it, vi } from "vitest";
import { shelfFixture } from "../../tests/fixtures/personal-shelf";
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), load: vi.fn(), barcode: vi.fn(), fetch: vi.fn(), convert: vi.fn(), generate: vi.fn() }));
vi.mock("./catalog-repository", () => ({ resolveProduct: mocks.resolve }));
vi.mock("./personal-shelf-evidence", () => ({ loadShelfEvidence: mocks.load }));
vi.mock("./open-food-facts", () => ({ getOpenFoodFactsProductByBarcode: mocks.barcode }));
vi.mock("./web-product-evidence", async importOriginal => ({ ...await importOriginal<typeof import("./web-product-evidence")>(), fetchVerifiedWebProduct: mocks.fetch }));
vi.mock("./shared-web-catalog", () => ({ sharedRecordToProduct: mocks.convert }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { models = { generateContent: mocks.generate }; } }));
import { assessResearchResult, researchShelfProduct } from "./shelf-research";
const lookup = { brand: "QA", name: "Chips", variant: "", packSize: "100 g" };
beforeEach(() => { vi.clearAllMocks(); mocks.resolve.mockResolvedValue(null); mocks.load.mockResolvedValue({}); mocks.barcode.mockResolvedValue(null); mocks.fetch.mockResolvedValue(null); mocks.generate.mockResolvedValue({ text: '{"urls":[]}' }); vi.stubEnv("GEMINI_API_KEY", "test"); });
describe("Shelf research exact-evidence boundary", () => {
  it("reuses exact scored catalog evidence without web search", async () => {
    mocks.resolve.mockResolvedValue(shelfFixture());
    expect((await researchShelfProduct({ ...lookup, productId: "qa-chips-a" })).status).toBe("ready");
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("keeps absent fiber provisional instead of inventing grams", () => {
    const result = assessResearchResult(shelfFixture("a", { fiberG: null }));
    expect(result).toMatchObject({ status: "ready", missing: ["fiber"], result: { shelfEvidence: { fiberG: null } } });
  });
  it("never treats model-generated nutrients as evidence", async () => {
    mocks.generate.mockResolvedValue({ text: '{"urls":[],"protein":99,"sugar":0}' });
    expect((await researchShelfProduct(lookup)).status).toBe("needs_info");
  });
  it("ignores unapproved discovery URLs and requires an exact verified page", async () => {
    mocks.generate.mockResolvedValue({ text: '{"urls":["http://localhost/private","https://unknown.example/product"]}' });
    expect((await researchShelfProduct(lookup)).result).toBeNull();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("does not award a score when the ingredient base is unrecognized", () => {
    expect(assessResearchResult(shelfFixture("a", { ingredientsText: "Mystery paste, salt" }))).toMatchObject({ status: "review", result: null, missing: ["recognized first ingredient"] });
  });
  it("surfaces provider errors for a durable retry", async () => {
    mocks.generate.mockRejectedValue(new Error("provider offline"));
    await expect(researchShelfProduct(lookup)).rejects.toThrow("provider offline");
  });
});
