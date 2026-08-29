import { describe, expect, it } from "vitest";
import nutritionProducts from "../../data/barbora-nutrition-index.generated.json";
import type { BarboraNutritionIndexProduct } from "./barbora-nutrition-index";
import { BARBORA_RATED_PRODUCT_COUNT, buildBarboraCatalogSnapshot } from "./barbora-supabase-catalog";

describe("Barbora Supabase catalog snapshot", () => {
  it("contains only exact SKUs with complete protein and sugar", () => {
    const snapshot = buildBarboraCatalogSnapshot({
      nutritionProducts: nutritionProducts as BarboraNutritionIndexProduct[],
      snapshotCheckedAt: "2026-08-29T00:00:00.000Z"
    });

    expect(snapshot.summary).toMatchObject({
      sourceId: "barbora_lv",
      registryCount: BARBORA_RATED_PRODUCT_COUNT,
      completeNutritionCount: BARBORA_RATED_PRODUCT_COUNT,
      pricedCount: 0
    });
    expect(snapshot.summary.snapshotChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.productRows).toHaveLength(BARBORA_RATED_PRODUCT_COUNT);
    expect(snapshot.productRows.every((row) => row.protein_g_100 >= 0 && row.total_sugar_g_100 >= 0)).toBe(true);
    expect(snapshot.productRows.every((row) => row.price === null && row.currency === null)).toBe(true);
    expect(snapshot.productRows.every((row) => row.nutrition_revalidate_after > row.nutrition_verified_at)).toBe(true);
  });

  it("fails closed if the curated catalog count changes unexpectedly", () => {
    const product = (nutritionProducts as BarboraNutritionIndexProduct[])[0];
    expect(() => buildBarboraCatalogSnapshot({
      nutritionProducts: [product],
      snapshotCheckedAt: "2026-08-29T00:00:00.000Z"
    })).toThrow("must contain exactly 7433 exact SKUs");
  });
});
