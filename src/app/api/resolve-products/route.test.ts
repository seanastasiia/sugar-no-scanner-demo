import { describe, expect, it, vi } from "vitest";
import { createResolveProductsPost } from "./route";

const detection = {
  productId: "visual:cola",
  confidence: 0.91,
  box: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
  observedText: "Coca-Cola Original 330 ml",
  identity: {
    brand: "Coca-Cola",
    name: "Coca-Cola Original 330 ml",
    variant: null,
    packSize: "330 ml",
    category: null,
    matchKind: "visual_only" as const,
    searchQuery: "Coca-Cola Original 330 ml"
  },
  shelfPrice: null
};

function request(body: unknown) {
  return new Request("https://scanner.example/api/resolve-products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("product enrichment route", () => {
  it("resolves identity-only detections without receiving another image", async () => {
    const resolve = vi.fn(async () => [detection]);
    const post = createResolveProductsPost({
      listProducts: async () => [],
      resolve,
      limiter: { consume: () => ({ allowed: true, remaining: 20, retryAfterSeconds: 0 }) }
    });
    const response = await post(request({ detections: [detection] }));
    expect(response.status).toBe(200);
    expect(resolve).toHaveBeenCalledWith(
      [expect.objectContaining({ brand: "Coca-Cola", searchQuery: "Coca-Cola Original 330 ml" })],
      [],
      undefined,
      3,
      "complete"
    );
    expect(await response.json()).toMatchObject({ imageStored: false, detections: [detection] });
  });

  it("rejects raw images and oversized detection lists", async () => {
    const post = createResolveProductsPost({
      limiter: { consume: () => ({ allowed: true, remaining: 20, retryAfterSeconds: 0 }) }
    });
    expect((await post(request({ detections: [detection], imageDataUrl: "data:image/jpeg;base64,YWJj" }))).status).toBe(400);
    expect((await post(request({ detections: Array.from({ length: 9 }, () => detection) }))).status).toBe(400);
  });
});
