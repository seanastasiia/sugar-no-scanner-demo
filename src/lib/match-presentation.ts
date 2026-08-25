import type { RatingSignal, ScoredProduct } from "./types";

export type MatchTone = "strong" | "middle" | "lower" | "pending";
export type SignalCompleteness = "full" | "partial" | "limited" | "identified";

const MATCH_TONE_LABELS: Record<MatchTone, string> = {
  strong: "Great fit",
  middle: "Moderate fit",
  lower: "Low fit",
  pending: "Data pending"
};

interface MatchCriterion {
  key: "protein" | "sugar";
  label: string;
  status: "Higher" | "Middle" | "Lower" | "Pending" | "Not listed";
  tone: MatchTone;
}

interface OverlayPresentation {
  label: string;
  tone: MatchTone;
  completeness: SignalCompleteness;
  completenessLabel: string;
  signalCount: number;
}

export function globalBestProductId(comparison: { cohorts: unknown[]; winnerIds: string[] }): string | undefined {
  return comparison.cohorts.length === 1 && comparison.winnerIds.length === 1
    ? comparison.winnerIds[0]
    : undefined;
}

/**
 * Keeps the scan readable without turning missing nutrition into a score.
 * Rated products are ordered from higher to lower Sugar.no fit; recognized
 * products without a complete fit stay in their original scan order at the end.
 */
export function rankScanProductIds(
  productIds: string[],
  products: Record<string, Pick<ScoredProduct, "matchScore"> | undefined>
): string[] {
  const originalOrder = new Map<string, number>();
  const uniqueIds = productIds.filter((id, index) => {
    if (originalOrder.has(id)) return false;
    originalOrder.set(id, index);
    return true;
  });

  return uniqueIds.sort((leftId, rightId) => {
    const leftScore = products[leftId]?.matchScore;
    const rightScore = products[rightId]?.matchScore;
    const leftRated = typeof leftScore === "number";
    const rightRated = typeof rightScore === "number";
    if (leftRated !== rightRated) return leftRated ? -1 : 1;
    if (leftRated && rightRated && leftScore !== rightScore) return rightScore - leftScore;
    return (originalOrder.get(leftId) ?? 0) - (originalOrder.get(rightId) ?? 0);
  });
}

const signalLabels: Record<RatingSignal, string> = {
  protein: "protein",
  inverseSugar: "total sugar"
};

function joinSignalLabels(labels: string[]) {
  if (labels.length <= 1) return labels[0] || "nutrition";
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

export function partialNutritionExplanation(signalMask: RatingSignal[]): string {
  const available = signalMask.map((signal) => signalLabels[signal]);
  const missing = (Object.keys(signalLabels) as RatingSignal[])
    .filter((signal) => !signalMask.includes(signal))
    .map((signal) => signalLabels[signal]);
  const availableText = joinSignalLabels(available);
  const missingText = joinSignalLabels(missing);
  return `${availableText[0]?.toUpperCase() || "N"}${availableText.slice(1)} is source-backed. ${missingText[0]?.toUpperCase() || "N"}${missingText.slice(1)} is not listed, so Sugar.no does not calculate an overall fit.`;
}

function percentileTone(value: number): Exclude<MatchTone, "pending"> {
  if (value >= 67) return "strong";
  if (value >= 34) return "middle";
  return "lower";
}

export function overallMatchPresentation(score: number | null): { label: string; tone: MatchTone } {
  const tone: MatchTone = score === null ? "pending" : score >= 67 ? "strong" : score >= 50 ? "middle" : "lower";
  return { label: matchToneLabel(tone), tone };
}

function matchToneLabel(tone: MatchTone): string {
  return MATCH_TONE_LABELS[tone];
}

export function overlayMatchPresentation(product?: ScoredProduct): OverlayPresentation {
  if (!product) {
    return {
      label: "Identified",
      tone: "pending",
      completeness: "identified",
      completenessLabel: "Nutrition checking",
      signalCount: 0
    };
  }

  const signalCount = Math.max(0, Math.min(2, product.ratingSignalCount));
  if (signalCount <= 1) {
    return {
      label: signalCount === 1 ? "Limited view" : "Identified",
      tone: "pending",
      completeness: signalCount === 1 ? "limited" : "identified",
      completenessLabel: signalCount === 1 ? "1/2 signal" : "Nutrition checking",
      signalCount
    };
  }

  const scorePresentation = overallMatchPresentation(product.matchScore);
  return {
    ...scorePresentation,
    completeness: signalCount === 2 ? "full" : "partial",
    completenessLabel: `${signalCount}/2 signals`,
    signalCount
  };
}

export function matchCriteria(product: ScoredProduct): MatchCriterion[] {
  const breakdown = product.criterionScores;
  if (!breakdown) {
    return [
      { key: "protein", label: "Protein", status: "Pending", tone: "pending" },
      { key: "sugar", label: "Sugar", status: "Pending", tone: "pending" }
    ];
  }

  const criterionTone = (value: number | null) => (value === null ? "pending" as const : percentileTone(value));
  const proteinTone = criterionTone(breakdown.protein);
  const sugarTone = criterionTone(breakdown.inverseSugar);
  const directionalStatus = (tone: Exclude<MatchTone, "pending">, inverse = false) => {
    if (tone === "middle") return "Middle" as const;
    if (inverse) return tone === "strong" ? ("Lower" as const) : ("Higher" as const);
    return tone === "strong" ? ("Higher" as const) : ("Lower" as const);
  };

  return [
    {
      key: "protein",
      label: "Protein",
      status: proteinTone === "pending" ? "Not listed" : directionalStatus(proteinTone),
      tone: proteinTone
    },
    {
      key: "sugar",
      label: "Sugar",
      status: sugarTone === "pending" ? "Not listed" : directionalStatus(sugarTone, true),
      tone: sugarTone
    }
  ];
}
