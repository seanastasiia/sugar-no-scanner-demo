import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RetailerOffer } from "@/lib/types";

const { getKnownOffer } = vi.hoisted(() => ({ getKnownOffer: vi.fn() }));

vi.mock("@/server/retailer-offers", () => ({
  getKnownRetailerOfferByKey: getKnownOffer
}));

import { POST } from "./route";

const offer: RetailerOffer = {
  retailer: "Barbora",
  slug: "example-200-g",
  title: "Example 200g",
  brand: "Example",
  url: "https://barbora.lv/produkti/example-200-g",
  price: 1.49,
  currency: "EUR",
  unitPrice: 7.45,
  unit: "kg",
  imageUrl: null,
  checkedAt: "2026-08-26T10:00:00.000Z",
  matchConfidence: 1,
  exactSku: true
};

beforeEach(() => getKnownOffer.mockReset());

describe("POST /api/offers", () => {
  it("rejects a cross-origin browser request before retailer lookup", async () => {
    const response = await POST(new Request("http://localhost/api/offers", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
      body: JSON.stringify({ keys: ["barbora:example-200-g"] })
    }));
    expect(response.status).toBe(403);
    expect(getKnownOffer).not.toHaveBeenCalled();
  });

  it("rejects malformed requests", async () => {
    const response = await POST(new Request("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ keys: ["https://unsafe.example/product"] })
    }));
    expect(response.status).toBe(400);
  });

  it("deduplicates retailer keys and returns exact current offers", async () => {
    getKnownOffer.mockResolvedValue(offer);
    const response = await POST(new Request("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ keys: ["barbora:example-200-g", "barbora:example-200-g"] })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ offers: { "barbora:example-200-g": offer } });
    expect(getKnownOffer).toHaveBeenCalledTimes(1);
  });

  it("accepts one offer candidate for every product in a ten-product scan", async () => {
    getKnownOffer.mockResolvedValue(offer);
    const keys = Array.from({ length: 10 }, (_, index) => `rimi_lv:example-${index + 1}`);
    const response = await POST(new Request("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ keys })
    }));

    expect(response.status).toBe(200);
    expect(Object.keys((await response.json()).offers)).toEqual(keys);
    expect(getKnownOffer).toHaveBeenCalledTimes(10);
  });
});
