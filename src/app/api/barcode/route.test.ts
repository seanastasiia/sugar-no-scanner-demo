import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOpenFoodFactsProductByBarcode, listProducts, resolveBarcodeFromKnownCatalogs, resolveSharedWebBarcode } = vi.hoisted(() => ({
  getOpenFoodFactsProductByBarcode: vi.fn(),
  listProducts: vi.fn(),
  resolveBarcodeFromKnownCatalogs: vi.fn(),
  resolveSharedWebBarcode: vi.fn()
}));

vi.mock("@/server/open-food-facts", () => ({ getOpenFoodFactsProductByBarcode }));
vi.mock("@/server/catalog-repository", () => ({ listProducts }));
vi.mock("@/server/barcode-resolution", () => ({ resolveBarcodeFromKnownCatalogs, resolveSharedWebBarcode }));

const barcode = "4006381333931";
const product = { id: "off:04006381333931", gtin: "04006381333931" };
const resolution = {
  source: "open_food_facts",
  detection: { productId: product.id, confidence: 1, inlineProduct: product }
};

function request(value = barcode) {
  return new Request("https://scanner.example/api/barcode", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ barcode: value })
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  listProducts.mockResolvedValue([]);
  resolveBarcodeFromKnownCatalogs.mockReturnValueOnce(null).mockReturnValueOnce(resolution);
  getOpenFoodFactsProductByBarcode.mockResolvedValue(product);
  resolveSharedWebBarcode.mockResolvedValue(null);
});

describe("barcode route dynamic OFF fallback", () => {
  it("tries an exact Open Food Facts card after checked-in catalogs and returns its source", async () => {
    const { POST } = await import("./route");
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(getOpenFoodFactsProductByBarcode).toHaveBeenCalledWith(barcode);
    expect(resolveBarcodeFromKnownCatalogs).toHaveBeenNthCalledWith(2, barcode, [product], "open_food_facts");
    expect(resolveSharedWebBarcode).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ status: "matched", source: "open_food_facts", imageStored: false });
  });

  it("does not call external sources for malformed input", async () => {
    const { POST } = await import("./route");
    const response = await POST(request("1234"));
    expect(response.status).toBe(400);
    expect(getOpenFoodFactsProductByBarcode).not.toHaveBeenCalled();
    expect(resolveSharedWebBarcode).not.toHaveBeenCalled();
  });
});
