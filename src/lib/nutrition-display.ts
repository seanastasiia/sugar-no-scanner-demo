import type { NutrientsPer100g } from "@/lib/types";

export function compactNutritionLabel(
  nutrients: Pick<NutrientsPer100g, "totalSugarG" | "carbohydrateG">
): string | null {
  const sugar = nutrients.totalSugarG;
  if (sugar === null || sugar === undefined) return null;

  const carbohydrate = nutrients.carbohydrateG;
  return carbohydrate === null || carbohydrate === undefined
    ? `Sugar ${sugar}g`
    : `Sugar ${sugar}g (Carbs ${carbohydrate}g)`;
}
