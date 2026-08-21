import type { ScoredProduct } from "./types";

export type MatchTone = "strong" | "middle" | "lower" | "pending";

const MATCH_TONE_LABELS: Record<MatchTone, string> = {
  strong: "Great fit",
  middle: "Moderate fit",
  lower: "Low fit",
  pending: "Data pending"
};

export interface MatchCriterion {
  key: "protein" | "fiber" | "sugar";
  label: string;
  status: "Higher" | "Middle" | "Lower" | "Pending" | "Not listed";
  tone: MatchTone;
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

export function matchToneLabel(tone: MatchTone): string {
  return MATCH_TONE_LABELS[tone];
}

export function matchCriteria(product: ScoredProduct): MatchCriterion[] {
  const breakdown = product.criterionScores;
  if (!breakdown) {
    return [
      { key: "protein", label: "Protein", status: "Pending", tone: "pending" },
      { key: "fiber", label: "Fiber", status: "Pending", tone: "pending" },
      { key: "sugar", label: "Sugar", status: "Pending", tone: "pending" }
    ];
  }

  const criterionTone = (value: number | null) => (value === null ? "pending" as const : percentileTone(value));
  const proteinTone = criterionTone(breakdown.protein);
  const fiberTone = criterionTone(breakdown.fiber);
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
      key: "fiber",
      label: "Fiber",
      status: fiberTone === "pending" ? "Not listed" : directionalStatus(fiberTone),
      tone: fiberTone
    },
    {
      key: "sugar",
      label: "Sugar",
      status: sugarTone === "pending" ? "Not listed" : directionalStatus(sugarTone, true),
      tone: sugarTone
    }
  ];
}
