import { getCatalog } from "@/lib/catalog";
import type { OnboardingProduct } from "@/lib/onboarding-comparison";
import { sampleResponse } from "./demo-scenes";

// Send only the four deterministic sample records, never the whole catalog.
export function onboardingComparison(): OnboardingProduct[] {
  const catalog = getCatalog();
  const products = (sampleResponse("sample-shelf") || []).flatMap((detection) => {
    const product = catalog.find((item) => item.id === detection.productId);
    return product ? [{
      id: product.id,
      name: detection.observedText || `${product.brand} ${product.shortName}`,
      imageUrl: product.imageUrl,
      score: product.matchScore,
      sugar: product.nutrientsPer100g.totalSugarG,
      protein: product.nutrientsPer100g.proteinG
    }] : [];
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return products.map((product) => ({
    ...product,
    rank: product.score === null ? null : products.findIndex((other) => other.score === product.score) + 1
  }));
}
