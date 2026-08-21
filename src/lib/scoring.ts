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
  const proteins = products
    .map((product) => product.nutrientsPer100g.proteinG)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const fibers = products
    .map((product) => product.nutrientsPer100g.fiberG)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const sugars = products
    .map((product) => product.nutrientsPer100g.totalSugarG)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return products.map((product) => {
    if (!hasCompleteNutrition(product)) {
      return {
        ...product,
        matchScore: null,
        matchReason: "missing_nutrition",
        ratingBasis: "catalog_percentile",
        ratingSignalCount: Object.values(product.nutrientsPer100g).filter(
          (value) => typeof value === "number" && Number.isFinite(value)
        ).length,
        criterionScores: null
      };
    }

    const protein = percentileRank(product.nutrientsPer100g.proteinG as number, proteins);
    const fiber = percentileRank(product.nutrientsPer100g.fiberG as number, fibers);
    const inverseSugar = 100 - percentileRank(product.nutrientsPer100g.totalSugarG as number, sugars);

    return {
      ...product,
      matchScore: Math.round((protein + fiber + inverseSugar) / 3),
      matchReason: "complete",
      ratingBasis: "catalog_percentile",
      ratingSignalCount: 3,
      criterionScores: { protein, fiber, inverseSugar }
    };
  });
}

function proteinReferenceScore(proteinG: number, energyKcal: number): number {
  const proteinEnergyShare = energyKcal > 0 ? ((proteinG * 4) / energyKcal) * 100 : 0;
  if (proteinEnergyShare >= 20) return 100;
  if (proteinEnergyShare >= 12) return 55;
  return 20;
}

function fiberReferenceScore(fiberG: number, energyKcal: number): number {
  const perHundredKcal = energyKcal > 0 ? (fiberG / energyKcal) * 100 : 0;
  if (fiberG >= 6 || perHundredKcal >= 3) return 100;
  if (fiberG >= 3 || perHundredKcal >= 1.5) return 55;
  return 20;
}

function inverseSugarReferenceScore(totalSugarG: number, basis: ProductRecord["nutritionBasis"]): number {
  const lowSugarThreshold = basis === "100ml" ? 2.5 : 5;
  if (totalSugarG <= lowSugarThreshold) return 100;
  // Sugar.no's demo middle band is intentionally explicit: up to 2x the EU low-sugar threshold.
  if (totalSugarG <= lowSugarThreshold * 2) return 55;
  return 20;
}

/**
 * Builds an on-demand Sugar.no quick view from nutrients listed on an exact
 * Barbora product page. The values are reference bands, not category percentiles
 * and not a medical or absolute health score.
 */
export function scoreBarboraProduct(product: ProductRecord): ScoredProduct {
  const { proteinG, fiberG, totalSugarG } = product.nutrientsPer100g;
  const energyKcal = product.energyKcalPer100;
  const hasProtein = typeof proteinG === "number" && Number.isFinite(proteinG);
  const hasFiber = typeof fiberG === "number" && Number.isFinite(fiberG);
  const hasSugar = typeof totalSugarG === "number" && Number.isFinite(totalSugarG);
  const hasEnergy = typeof energyKcal === "number" && Number.isFinite(energyKcal) && energyKcal > 0;

  if (!hasProtein || !hasSugar || !hasEnergy) {
    return {
      ...product,
      matchScore: null,
      matchReason: "missing_nutrition",
      ratingBasis: "barbora_reference_partial",
      ratingSignalCount: [hasProtein && hasEnergy, hasFiber && hasEnergy, hasSugar].filter(Boolean).length,
      criterionScores: null
    };
  }

  const protein = proteinReferenceScore(proteinG, energyKcal);
  const fiber = hasFiber ? fiberReferenceScore(fiberG, energyKcal) : null;
  const inverseSugar = inverseSugarReferenceScore(totalSugarG, product.nutritionBasis);
  const availableScores = [protein, fiber, inverseSugar].filter(
    (score): score is number => typeof score === "number"
  );

  return {
    ...product,
    matchScore: Math.round(availableScores.reduce((sum, score) => sum + score, 0) / availableScores.length),
    matchReason: fiber === null ? "partial_nutrition" : "complete",
    ratingBasis: fiber === null ? "barbora_reference_partial" : "barbora_reference",
    ratingSignalCount: availableScores.length,
    criterionScores: { protein, fiber, inverseSugar }
  };
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
