import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBarboraOffer, getExternalOffer } = vi.hoisted(() => ({
  getBarboraOffer: vi.fn(),
  getExternalOffer: vi.fn()
}));

vi.mock("./barbora-catalog", () => ({
  getKnownBarboraOfferBySlug: getBarboraOffer
}));

vi.mock("./external-catalog", () => ({
  getExternalCatalogOfferByKey: getExternalOffer
}));

import { getKnownRetailerOfferByKey } from "./retailer-offers";

beforeEach(() => {
  getBarboraOffer.mockReset();
  getExternalOffer.mockReset();
});

describe("getKnownRetailerOfferByKey", () => {
  it("dispatches exact Barbora keys by product slug", async () => {
    getBarboraOffer.mockResolvedValue({ retailer: "Barbora" });
    await expect(getKnownRetailerOfferByKey("barbora:example-200-g")).resolves.toEqual({ retailer: "Barbora" });
    expect(getBarboraOffer).toHaveBeenCalledWith("example-200-g");
    expect(getExternalOffer).not.toHaveBeenCalled();
  });

  it.each(["rimi_lv:100", "livin_lv:abc"])("dispatches %s to the connected catalog", async (key) => {
    getExternalOffer.mockResolvedValue({ retailer: key.split(":")[0] });
    await expect(getKnownRetailerOfferByKey(key)).resolves.toBeTruthy();
    expect(getExternalOffer).toHaveBeenCalledWith(key);
    expect(getBarboraOffer).not.toHaveBeenCalled();
  });

  it("fails closed for an unsupported source", async () => {
    await expect(getKnownRetailerOfferByKey("off:123")).resolves.toBeNull();
    expect(getBarboraOffer).not.toHaveBeenCalled();
    expect(getExternalOffer).not.toHaveBeenCalled();
  });
});
