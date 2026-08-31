import snapshot from "../../data/barbora-nutrition-index.generated.json";
import activeFoodSnapshot from "../../data/barbora-food-product-index.generated.json";
import { areInterchangeable, hasGreatFit } from "@/lib/better-alternatives";
import { scoreBarboraProduct } from "@/lib/scoring";
import type { ScoredProduct } from "@/lib/types";

export interface BarboraNutritionIndexProduct {
  slug: string;
  title: string;
  brand: string;
  category: string | null;
  packSize: string;
  nutritionBasis: "100g" | "100ml";
  energyKcal: number;
  proteinG: number;
  totalSugarG: number;
  carbohydrateG?: number | null;
  imageUrl: string | null;
  isAdult: boolean;
  checkedAt: string;
}

const products = snapshot as BarboraNutritionIndexProduct[];
const productsBySlug = new Map(products.map((product) => [product.slug, product]));
const activeFoodSlugs = new Set(activeFoodSnapshot as string[]);
let scoredProducts: ScoredProduct[] | null = null;

function packSizeInBaseUnits(value: string): number {
  const normalized = value.toLowerCase().replaceAll("×", "x").replaceAll(",", ".");
  const multi = normalized.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l)\b/);
  const single = normalized.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l)\b/);
  const match = multi || single;
  if (!match) return Number.parseFloat(normalized) || 0;
  const count = multi ? Number.parseInt(match[1], 10) : 1;
  const amount = Number.parseFloat(match[multi ? 2 : 1]);
  const unit = match[multi ? 3 : 2];
  const factor = unit === "kg" || unit === "l" ? 1_000 : unit === "cl" ? 10 : 1;
  return count * amount * factor;
}

export function listIndexedBarboraNutrition(): BarboraNutritionIndexProduct[] {
  return products;
}

export function getIndexedBarboraNutrition(slug: string): BarboraNutritionIndexProduct | null {
  return productsBySlug.get(slug) || null;
}

export function indexedBarboraProductToScoredProduct(product: BarboraNutritionIndexProduct): ScoredProduct {
  const retailerUrl = `https://barbora.lv/produkti/${product.slug}`;
  const scored = scoreBarboraProduct({
    id: `barbora:${product.slug}`,
    retailerProductId: product.slug,
    brand: product.brand,
    name: product.title,
    shortName: product.title,
    aliases: [product.slug.replaceAll("-", " ")],
    format: "other",
    category: product.category,
    packSizeG: packSizeInBaseUnits(product.packSize),
    nutritionBasis: product.nutritionBasis,
    energyKcalPer100: product.energyKcal,
    gtin: null,
    nutrientsPer100g: {
      proteinG: product.proteinG,
      fiberG: null,
      totalSugarG: product.totalSugarG,
      carbohydrateG: product.carbohydrateG ?? null
    },
    noAddedSugarClaim: false,
    imageUrl: product.imageUrl,
    retailerUrl,
    sources: [
      {
        label: "Barbora Latvia catalog snapshot",
        url: retailerUrl,
        checkedAt: product.checkedAt,
        fields: [
          "identity",
          "protein",
          "totalSugar",
          ...(product.carbohydrateG === null || product.carbohydrateG === undefined
            ? []
            : (["carbohydrate"] as const)),
          "retailerUrl"
        ],
        status: "secondary"
      }
    ],
    isGolden: false,
    accent: "coral"
  });

  if (!product.isAdult) return scored;
  return {
    ...scored,
    matchScore: null,
    matchReason: "missing_nutrition",
    ratingStatus: "identity_only",
    ratingSignalCount: 0,
    ratingSignalMask: [],
    criterionScores: null
  };
}

function listScoredProducts(): ScoredProduct[] {
  if (!scoredProducts) scoredProducts = products.map(indexedBarboraProductToScoredProduct);
  return scoredProducts;
}

export function listIndexedBarboraScoredProducts(): ScoredProduct[] {
  return listScoredProducts();
}

export function rankIndexedBetterAlternatives(
  indexed: BarboraNutritionIndexProduct,
  candidates: BarboraNutritionIndexProduct[] = products,
  activeSlugs: ReadonlySet<string> = activeFoodSlugs,
  limit = 8
): ScoredProduct[] {
  const product = indexedBarboraProductToScoredProduct(indexed);
  if (product.matchScore === null) return [];
  const currentMatchScore = product.matchScore;

  const scoredCandidates = candidates === products
    ? listScoredProducts()
    : candidates.map(indexedBarboraProductToScoredProduct);
  return scoredCandidates
    .filter((candidate) => {
      const slug = candidate.id.slice("barbora:".length);
      return candidate.id !== product.id && activeSlugs.has(slug);
    })
    .filter(
      (candidate) =>
        candidate.ratingStatus === "complete" &&
        candidate.matchScore !== null &&
        hasGreatFit(candidate) &&
        candidate.matchScore >= currentMatchScore &&
        areInterchangeable(product, candidate)
    )
    .sort((left, right) => {
      const scoreDifference = (right.matchScore ?? -1) - (left.matchScore ?? -1);
      if (scoreDifference) return scoreDifference;
      const leftPackDistance = Math.abs(left.packSizeG - product.packSizeG);
      const rightPackDistance = Math.abs(right.packSizeG - product.packSizeG);
      return leftPackDistance - rightPackDistance || left.name.localeCompare(right.name);
    })
    .slice(0, limit);
}

export function getIndexedBarboraProductWithAlternatives(slug: string, limit = 8) {
  const indexed = getIndexedBarboraNutrition(slug);
  if (!indexed) return null;
  const product = indexedBarboraProductToScoredProduct(indexed);
  const alternatives = rankIndexedBetterAlternatives(indexed, products, activeFoodSlugs, limit);
  return { product, alternatives };
}
