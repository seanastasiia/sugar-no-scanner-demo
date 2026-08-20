import { describe, expect, it } from "vitest";
import { rankSimilarProducts, scoreCatalog } from "./scoring";
import type { ProductRecord } from "./types";

function product(
  id: string,
  proteinG: number | null,
  fiberG: number | null,
  totalSugarG: number | null,
  format: ProductRecord["format"] = "bar"
): ProductRecord {
  return {
    id,
    retailerProductId: id,
    brand: "Test",
    name: `Product ${id}`,
    shortName: id,
    aliases: [],
    format,
    packSizeG: 50,
    gtin: null,
    nutrientsPer100g: { proteinG, fiberG, totalSugarG },
    noAddedSugarClaim: false,
    imageUrl: null,
    retailerUrl: `https://example.com/${id}`,
    sources: [],
    isGolden: false,
    accent: "coral"
  };
}

describe("scoreCatalog", () => {
  it("rewards more protein, more fiber and less total sugar equally", () => {
    const scored = scoreCatalog([
      product("top", 30, 12, 2),
      product("middle", 20, 6, 8),
      product("bottom", 10, 2, 20)
    ]);

    expect(scored.find((item) => item.id === "top")?.matchScore).toBe(100);
    expect(scored.find((item) => item.id === "middle")?.matchScore).toBe(50);
    expect(scored.find((item) => item.id === "bottom")?.matchScore).toBe(0);
  });

  it("does not score products with incomplete nutrition", () => {
    const [scored] = scoreCatalog([product("pending", 25, null, 3)]);
    expect(scored.matchScore).toBeNull();
    expect(scored.matchReason).toBe("missing_nutrition");
  });

  it("does not include the no-added-sugar claim in the score", () => {
    const first = product("first", 20, 5, 5);
    const second = { ...product("second", 20, 5, 5), noAddedSugarClaim: true };
    const scored = scoreCatalog([first, second]);
    expect(scored[0].matchScore).toBe(scored[1].matchScore);
  });
});

describe("rankSimilarProducts", () => {
  it("ranks same-format products before higher-scoring different formats", () => {
    const scored = scoreCatalog([
      product("current", 20, 5, 8, "bar"),
      product("same-format", 21, 6, 7, "bar"),
      product("different", 40, 20, 0, "cookie")
    ]);
    const ranked = rankSimilarProducts(scored[0], scored);
    expect(ranked.map((item) => item.id)).toEqual(["same-format", "different"]);
  });
});
