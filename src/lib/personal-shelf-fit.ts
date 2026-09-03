import type { ShelfAssessment } from "./personal-shelf-rank";

// Presentation bands for the personal score, not the legacy sugar/protein Fit.
export const PERSONAL_FIT_BANDS = { great: 75, moderate: 50 } as const;
export const PERSONAL_FIT_GUIDE = "Personal fit: Great 75–100 · Moderate 50–74 · Low 0–49. Preference bands, not a health rating.";
type FitBand = "great" | "moderate" | "low";
export type PersonalShelfFit = { tone: FitBand | "uncertain"; label: string; provisional: boolean };
const labels: Record<FitBand, string> = { great: "Great fit", moderate: "Moderate fit", low: "Low fit" };
const band = (score: number): FitBand => score >= PERSONAL_FIT_BANDS.great ? "great" : score >= PERSONAL_FIT_BANDS.moderate ? "moderate" : "low";
const valid = (score: unknown): score is number => typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100;

export function personalShelfFit(assessment: Pick<ShelfAssessment, "status" | "score" | "scoreRange">): PersonalShelfFit | null {
  if (assessment.status === "scored" && valid(assessment.score) && assessment.scoreRange === null) {
    const tone = band(assessment.score);
    return { tone, label: labels[tone], provisional: false };
  }
  if (assessment.status !== "provisional" || assessment.score !== null || !assessment.scoreRange) return null;
  const { min, max } = assessment.scoreRange;
  if (!valid(min) || !valid(max) || min > max) return null;
  const low = band(min);
  const high = band(max);
  return low === high
    ? { tone: low, label: labels[low], provisional: true }
    : { tone: "uncertain", label: `${labels[low].replace(" fit", "")} to ${labels[high]}`, provisional: true };
}
