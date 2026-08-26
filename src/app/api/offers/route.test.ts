import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RetailerOffer } from "@/lib/types";

const { getKnownOffer } = vi.hoisted(() => ({ getKnownOffer: vi.fn() }));

vi.mock("@/server/barbora-catalog", () => ({
  getKnownBarboraOfferBySlug: getKnownOffer
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
  it("rejects malformed requests", async () => {
    const response = await POST(new Request("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ slugs: ["https://unsafe.example/product"] })
    }));
    expect(response.status).toBe(400);
  });

  it("deduplicates slugs and returns exact current offers", async () => {
    getKnownOffer.mockResolvedValue(offer);
    const response = await POST(new Request("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ slugs: ["example-200-g", "example-200-g"] })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ offers: { "example-200-g": offer } });
    expect(getKnownOffer).toHaveBeenCalledTimes(1);
  });

  it("accepts enough candidates to verify availability before showing four alternatives", async () => {
    getKnownOffer.mockImplementation(async (slug: string) => ({ ...offer, slug }));
    const slugs = Array.from({ length: 8 }, (_, index) => `example-${index + 1}`);
    const response = await POST(new Request("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ slugs })
    }));

    expect(response.status).toBe(200);
    expect(Object.keys((await response.json()).offers)).toEqual(slugs);
    expect(getKnownOffer).toHaveBeenCalledTimes(8);
  });
});
