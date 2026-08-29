export type NutritionSourceKind = "web" | "retailer" | "manufacturer" | "label" | "database";

const DAY_MS = 24 * 60 * 60_000;

const NUTRITION_REVALIDATION_DAYS: Record<NutritionSourceKind, number> = {
  web: 30,
  retailer: 90,
  manufacturer: 180,
  label: 180,
  database: 180
};

export const PRICE_REVALIDATION_MS = 24 * 60 * 60_000;

export function nutritionRevalidateAfter(verifiedAt: string | number | Date, kind: NutritionSourceKind): string {
  const verifiedAtMs = new Date(verifiedAt).getTime();
  if (!Number.isFinite(verifiedAtMs)) throw new Error("Invalid nutrition verification timestamp");
  return new Date(verifiedAtMs + NUTRITION_REVALIDATION_DAYS[kind] * DAY_MS).toISOString();
}

export function priceRevalidateAfter(verifiedAt: string | number | Date): string {
  const verifiedAtMs = new Date(verifiedAt).getTime();
  if (!Number.isFinite(verifiedAtMs)) throw new Error("Invalid price verification timestamp");
  return new Date(verifiedAtMs + PRICE_REVALIDATION_MS).toISOString();
}
