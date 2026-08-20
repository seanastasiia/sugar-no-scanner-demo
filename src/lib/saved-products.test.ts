import { describe, expect, it } from "vitest";
import { MAX_SAVED_PRODUCTS, parseSavedProductIds, toggleSavedProductId } from "./saved-products";

describe("saved product helpers", () => {
  it("fails closed for malformed local storage and removes duplicates", () => {
    expect(parseSavedProductIds("not-json")).toEqual([]);
    expect(parseSavedProductIds(JSON.stringify(["one", "one", 42, "two"]))).toEqual(["one", "two"]);
  });

  it("adds newest products first and toggles an existing product off", () => {
    expect(toggleSavedProductId(["one"], "two")).toEqual(["two", "one"]);
    expect(toggleSavedProductId(["two", "one"], "two")).toEqual(["one"]);
  });

  it("bounds device storage to the constrained catalog size", () => {
    const ids = Array.from({ length: MAX_SAVED_PRODUCTS }, (_, index) => `item-${index}`);
    expect(toggleSavedProductId(ids, "new-item")).toHaveLength(MAX_SAVED_PRODUCTS);
    expect(toggleSavedProductId(ids, "new-item")[0]).toBe("new-item");
  });
});
