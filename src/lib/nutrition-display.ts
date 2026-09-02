import type { NutrientsPer100g } from "@/lib/types";

export function compactNutritionLabel(
  nutrients: Pick<NutrientsPer100g, "proteinG" | "totalSugarG" | "carbohydrateG">
): string | null {
  const protein = nutrients.proteinG;
  const sugar = nutrients.totalSugarG;
  if (protein === null || protein === undefined || sugar === null || sugar === undefined) return null;

  const carbohydrate = nutrients.carbohydrateG;
  return carbohydrate === null || carbohydrate === undefined
    ? `Protein ${protein}g · Sugar ${sugar}g`
    : `Protein ${protein}g · Sugar ${sugar}g · Carbs ${carbohydrate}g`;
}
