import type { ScoredProduct } from "./types";

export type MatchTone = "strong" | "middle" | "lower" | "pending";

export interface MatchCriterion {
  key: "protein" | "fiber" | "sugar";
  label: string;
  status: "Higher" | "Middle" | "Lower" | "Pending";
  tone: MatchTone;
}

function percentileTone(value: number): Exclude<MatchTone, "pending"> {
  if (value >= 67) return "strong";
  if (value >= 34) return "middle";
  return "lower";
}

export function overallMatchPresentation(score: number | null): { label: string; tone: MatchTone } {
  if (score === null) return { label: "Data pending", tone: "pending" };
  if (score >= 67) return { label: "Strong match", tone: "strong" };
  if (score >= 50) return { label: "Middle match", tone: "middle" };
  return { label: "Lower match", tone: "lower" };
}

export function matchCriteria(product: ScoredProduct): MatchCriterion[] {
  const breakdown = product.percentileBreakdown;
  if (!breakdown) {
    return [
      { key: "protein", label: "Protein", status: "Pending", tone: "pending" },
      { key: "fiber", label: "Fiber", status: "Pending", tone: "pending" },
      { key: "sugar", label: "Sugar", status: "Pending", tone: "pending" }
    ];
  }

  const proteinTone = percentileTone(breakdown.protein);
  const fiberTone = percentileTone(breakdown.fiber);
  const sugarTone = percentileTone(breakdown.inverseSugar);
  const directionalStatus = (tone: Exclude<MatchTone, "pending">, inverse = false) => {
    if (tone === "middle") return "Middle" as const;
    if (inverse) return tone === "strong" ? ("Lower" as const) : ("Higher" as const);
    return tone === "strong" ? ("Higher" as const) : ("Lower" as const);
  };

  return [
    { key: "protein", label: "Protein", status: directionalStatus(proteinTone), tone: proteinTone },
    { key: "fiber", label: "Fiber", status: directionalStatus(fiberTone), tone: fiberTone },
    { key: "sugar", label: "Sugar", status: directionalStatus(sugarTone, true), tone: sugarTone }
  ];
}
