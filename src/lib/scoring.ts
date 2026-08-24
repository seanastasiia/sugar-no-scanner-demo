import type { ProductRecord, RatingSignal, ScoredProduct } from "./types";

type CriterionScores = NonNullable<ScoredProduct["criterionScores"]>;

const ratingSignals: RatingSignal[] = ["protein", "inverseSugar"];

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function signalMask(scores: CriterionScores): RatingSignal[] {
  return ratingSignals.filter((signal) => isFiniteNumber(scores[signal]));
}

function buildScoredProduct(
  product: ProductRecord,
  scores: CriterionScores,
  completeBasis: ScoredProduct["ratingBasis"],
  partialBasis: ScoredProduct["ratingBasis"]
): ScoredProduct {
  const mask = signalMask(scores);
  const availableScores = mask.map((signal) => scores[signal] as number);
  const matchScore =
    availableScores.length === 2
      ? Math.round(availableScores.reduce((sum, score) => sum + score, 0) / availableScores.length)
      : null;
  const ratingStatus =
    mask.length === 2
      ? "complete"
      : mask.length === 1
          ? "limited_signal"
          : "identity_only";

  return {
    ...product,
    matchScore,
    matchReason:
      ratingStatus === "complete"
        ? "complete"
        : ratingStatus === "limited_signal"
            ? "limited_nutrition"
            : "missing_nutrition",
    ratingBasis: mask.length === 2 ? completeBasis : partialBasis,
    ratingStatus,
    ratingSignalCount: mask.length,
    ratingSignalMask: mask,
    criterionScores: mask.length ? scores : null
  };
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
  const sugars = products
    .map((product) => product.nutrientsPer100g.totalSugarG)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return products.map((product) => {
    const { proteinG, totalSugarG } = product.nutrientsPer100g;
    return buildScoredProduct(
      product,
      {
        protein: isFiniteNumber(proteinG) ? percentileRank(proteinG, proteins) : null,
        inverseSugar: isFiniteNumber(totalSugarG) ? 100 - percentileRank(totalSugarG, sugars) : null
      },
      "catalog_percentile",
      "catalog_percentile_partial"
    );
  });
}

function proteinReferenceScore(proteinG: number, energyKcal: number): number {
  const proteinEnergyShare = energyKcal > 0 ? ((proteinG * 4) / energyKcal) * 100 : 0;
  if (proteinEnergyShare >= 20) return 100;
  if (proteinEnergyShare >= 12) return 55;
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
  const { proteinG, totalSugarG } = product.nutrientsPer100g;
  const energyKcal = product.energyKcalPer100;
  const hasProtein = typeof proteinG === "number" && Number.isFinite(proteinG);
  const hasSugar = typeof totalSugarG === "number" && Number.isFinite(totalSugarG);
  const hasEnergy = typeof energyKcal === "number" && Number.isFinite(energyKcal) && energyKcal > 0;

  return buildScoredProduct(
    product,
    {
      protein: hasProtein && hasEnergy ? proteinReferenceScore(proteinG, energyKcal) : null,
      inverseSugar: hasSugar ? inverseSugarReferenceScore(totalSugarG, product.nutritionBasis) : null
    },
    "barbora_reference",
    "barbora_reference_partial"
  );
}

export interface FairComparisonCohort {
  key: string;
  productIds: string[];
  signalMask: RatingSignal[];
  scores: Record<string, number>;
  winnerId: string | null;
}

export interface FairComparisonResult {
  cohorts: FairComparisonCohort[];
  winnerIds: string[];
}

function comparisonMethod(product: ScoredProduct): "catalog_percentile" | "barbora_reference" {
  return product.ratingBasis?.startsWith("catalog_") ? "catalog_percentile" : "barbora_reference";
}

function comparisonCategory(product: ScoredProduct): string {
  const explicitCategory = product.category?.trim().toLowerCase();
  if (explicitCategory) return explicitCategory;
  if (product.format !== "other") return product.format;
  // Unknown-category retailer items must not become an accidental mega-cohort.
  return `unknown:${product.id}`;
}

/**
 * Compares only like-for-like products. A cohort must share category, per-100
 * basis and scoring method, and every member must have at least two of the same
 * source-backed signals. Winners are cohort-local; cross-cohort winners would
 * imply a comparison the source data cannot support.
 */
export function compareFairCohorts(products: ScoredProduct[], tieThreshold = 5): FairComparisonResult {
  const groups = new Map<string, ScoredProduct[]>();
  for (const product of products) {
    // Fail closed when an older or external payload identifies the product but
    // does not carry enough rating metadata for a fair comparison.
    if (!product.ratingBasis || product.ratingSignalCount < 2 || !product.criterionScores) continue;
    const key = [comparisonCategory(product), product.nutritionBasis || "100g", comparisonMethod(product)].join("|");
    groups.set(key, [...(groups.get(key) || []), product]);
  }

  const cohorts = [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([key, members]): FairComparisonCohort[] => {
      const stableMembers = [...members].sort((left, right) => left.id.localeCompare(right.id));
      if (stableMembers.length < 2) return [];
      const commonSignals = ratingSignals.filter((signal) =>
        stableMembers.every((product) => isFiniteNumber(product.criterionScores?.[signal]))
      );
      if (commonSignals.length < 2) return [];
      const scores = Object.fromEntries(
        stableMembers.map((product) => [
          product.id,
          Math.round(
            commonSignals.reduce((sum, signal) => sum + (product.criterionScores?.[signal] as number), 0) /
              commonSignals.length
          )
        ])
      );
      const ranked = stableMembers
        .map((product) => ({ id: product.id, score: scores[product.id] }))
        .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
      const winnerId = ranked[0].score - ranked[1].score >= tieThreshold ? ranked[0].id : null;
      return [{ key, productIds: stableMembers.map((product) => product.id), signalMask: commonSignals, scores, winnerId }];
    });

  return { cohorts, winnerIds: cohorts.flatMap((cohort) => (cohort.winnerId ? [cohort.winnerId] : [])) };
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
