import type { ProductRecord, ScoredProduct } from "./types";

function hasCompleteNutrition(product: ProductRecord): boolean {
  const values = Object.values(product.nutrientsPer100g);
  return values.every((value) => typeof value === "number" && Number.isFinite(value));
}

function percentileRank(value: number, population: number[]): number {
  if (population.length <= 1) return 100;
  const below = population.filter((candidate) => candidate < value).length;
  const equal = population.filter((candidate) => candidate === value).length;
  const midpointRank = below + Math.max(0, equal - 1) / 2;
  return Math.round((midpointRank / (population.length - 1)) * 100);
}

export function scoreCatalog(products: ProductRecord[]): ScoredProduct[] {
  const complete = products.filter(hasCompleteNutrition);
  const proteins = complete.map((product) => product.nutrientsPer100g.proteinG as number);
  const fibers = complete.map((product) => product.nutrientsPer100g.fiberG as number);
  const sugars = complete.map((product) => product.nutrientsPer100g.totalSugarG as number);

  return products.map((product) => {
    if (!hasCompleteNutrition(product)) {
      return {
        ...product,
        matchScore: null,
        matchReason: "missing_nutrition",
        percentileBreakdown: null
      };
    }

    const protein = percentileRank(product.nutrientsPer100g.proteinG as number, proteins);
    const fiber = percentileRank(product.nutrientsPer100g.fiberG as number, fibers);
    const inverseSugar = 100 - percentileRank(product.nutrientsPer100g.totalSugarG as number, sugars);

    return {
      ...product,
      matchScore: Math.round((protein + fiber + inverseSugar) / 3),
      matchReason: "complete",
      percentileBreakdown: { protein, fiber, inverseSugar }
    };
  });
}

export function rankSimilarProducts(
  current: ScoredProduct,
  products: ScoredProduct[],
  limit = 2
): ScoredProduct[] {
  return products
    .filter((candidate) => candidate.id !== current.id && candidate.matchScore !== null)
    .sort((left, right) => {
      const leftFormat = left.format === current.format ? 1 : 0;
      const rightFormat = right.format === current.format ? 1 : 0;
      if (leftFormat !== rightFormat) return rightFormat - leftFormat;
      return (right.matchScore ?? -1) - (left.matchScore ?? -1);
    })
    .slice(0, limit);
}
