import { describe, expect, it } from "vitest";
import { barboraProductSlug, isExactOnlineSaving } from "./online-offer";
import type { RetailerOffer, ShelfPrice } from "./types";

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

const shelfPrice: ShelfPrice = {
  amount: 1.99,
  currency: "EUR",
  observedText: "€1.99",
  confidence: 0.95
};

describe("online offer presentation", () => {
  it("extracts only an exact Barbora product slug", () => {
    expect(barboraProductSlug("https://barbora.lv/produkti/example-200-g?ref=scan")).toBe("example-200-g");
    expect(barboraProductSlug("https://example.com/example-200-g")).toBeNull();
  });

  it("claims an online saving only for an exact SKU with a lower price", () => {
    expect(isExactOnlineSaving(offer, shelfPrice)).toBe(true);
    expect(isExactOnlineSaving({ ...offer, exactSku: false }, shelfPrice)).toBe(false);
    expect(isExactOnlineSaving({ ...offer, price: 2.09 }, shelfPrice)).toBe(false);
    expect(isExactOnlineSaving(offer, null)).toBe(false);
  });
});
