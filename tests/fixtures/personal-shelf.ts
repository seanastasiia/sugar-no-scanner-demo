import type { ShelfEvidence } from "../../src/lib/personal-shelf-rank";
import type { ScoredProduct } from "../../src/lib/types";

/** Synthetic QA fixtures only. Never imported by a runtime or seed script. */
export function shelfFixture(id = "qa-chips-a", overrides: Partial<ShelfEvidence> = {}): ScoredProduct {
  const evidence: ShelfEvidence = {
    productId: id, source: "barbora_lv", sourceUrl: `https://barbora.lv/produkti/${id}`,
    checkedAt: "2026-09-03T09:00:00.000Z", gtin: null, category: "Chips", nutritionBasis: "100g",
    ingredientsText: "Potatoes, sunflower oil, salt", ingredientsLanguage: "en",
    energyKcal: 500, proteinG: 6, totalSugarG: 1, fiberG: 4, saltG: .5, saturatedFatG: 1,
    ...overrides
  };
  return {
    id, retailerProductId: id, brand: "QA fixture", name: id, shortName: id, aliases: [], format: "other", category: evidence.category,
    packSizeG: 100, nutritionBasis: "100g", energyKcalPer100: evidence.energyKcal, gtin: null,
    nutrientsPer100g: { proteinG: evidence.proteinG, totalSugarG: evidence.totalSugarG, fiberG: evidence.fiberG },
    noAddedSugarClaim: false, imageUrl: null, retailerUrl: evidence.sourceUrl, sources: [], isGolden: false, accent: "coral",
    matchScore: 60, matchReason: "complete", ratingBasis: "barbora_reference", ratingStatus: "complete", ratingSignalCount: 2,
    ratingSignalMask: ["protein", "inverseSugar"], criterionScores: { protein: 20, inverseSugar: 100 }, shelfEvidence: evidence
  };
}
