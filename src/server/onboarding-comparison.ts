import { getCatalog } from "@/lib/catalog";
import type { OnboardingProduct } from "@/lib/onboarding-comparison";
import { sampleResponse } from "./demo-scenes";

// Send only the four deterministic sample records, never the whole catalog.
export function onboardingComparison(): OnboardingProduct[] {
  const catalog = getCatalog();
  return (sampleResponse("sample-shelf") || []).flatMap((detection) => {
    const product = catalog.find((item) => item.id === detection.productId);
    return product ? [{
      id: product.id,
      name: detection.observedText || `${product.brand} ${product.shortName}`,
      sugar: product.nutrientsPer100g.totalSugarG,
      protein: product.nutrientsPer100g.proteinG
    }] : [];
  });
}
