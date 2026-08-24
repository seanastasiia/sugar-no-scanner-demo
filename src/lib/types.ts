export type ProductFormat = "bar" | "cookie" | "truffle" | "puree" | "other";

export type NutritionBasis = "100g" | "100ml";

export type RatingBasis =
  | "catalog_percentile"
  | "catalog_percentile_partial"
  | "barbora_reference"
  | "barbora_reference_partial";

export type RatingSignal = "protein" | "inverseSugar";

export type RatingStatus = "complete" | "partial_overall" | "limited_signal" | "identity_only";

export type NutrientDataStatus = "verified" | "secondary" | "pending";

export interface NutrientsPer100g {
  proteinG: number | null;
  fiberG: number | null;
  totalSugarG: number | null;
}

export interface ProductSource {
  label: string;
  url: string;
  checkedAt: string;
  fields: Array<"identity" | "protein" | "fiber" | "totalSugar" | "claim" | "retailerUrl">;
  status: NutrientDataStatus;
}

export interface ProductRecord {
  id: string;
  retailerProductId: string;
  brand: string;
  name: string;
  shortName: string;
  aliases: string[];
  format: ProductFormat;
  category?: string | null;
  packSizeG: number;
  nutritionBasis?: NutritionBasis;
  energyKcalPer100?: number | null;
  gtin: string | null;
  nutrientsPer100g: NutrientsPer100g;
  noAddedSugarClaim: boolean;
  imageUrl: string | null;
  retailerUrl: string;
  sources: ProductSource[];
  isGolden: boolean;
  accent: string;
}

export interface ScoredProduct extends ProductRecord {
  matchScore: number | null;
  matchReason: "complete" | "partial_nutrition" | "limited_nutrition" | "missing_nutrition";
  ratingBasis: RatingBasis;
  ratingStatus: RatingStatus;
  ratingSignalCount: number;
  ratingSignalMask: RatingSignal[];
  criterionScores: {
    protein: number | null;
    inverseSugar: number | null;
  } | null;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProductDetection {
  productId: string;
  catalogProductId?: string | null;
  confidence: number;
  box: BoundingBox;
  observedText: string;
  identity?: RecognizedProductIdentity;
  shelfPrice?: ShelfPrice | null;
  retailerOffer?: RetailerOffer | null;
  nutritionLinkConfidence?: number | null;
}

export interface RecognizedProductIdentity {
  brand: string;
  name: string;
  variant: string | null;
  packSize: string | null;
  category: string | null;
  matchKind: "verified_catalog" | "barbora" | "visual_only";
}

export interface ShelfPrice {
  amount: number;
  currency: "EUR";
  observedText: string;
  confidence: number;
}

export interface RetailerOffer {
  retailer: "Barbora";
  slug: string;
  title: string;
  brand: string;
  url: string;
  price: number;
  currency: "EUR";
  unitPrice: number | null;
  unit: string | null;
  imageUrl: string | null;
  checkedAt: string;
  matchConfidence: number;
  exactSku: boolean;
}

export type ScanSource = "camera" | "upload" | "sample-shelf" | "sample-conveyor";

export interface RecognitionResponse {
  requestId: string;
  status: "matched" | "not_sure" | "provider_unavailable";
  detections: ProductDetection[];
  latencyMs: number;
  model: string;
  imageStored: false;
}
