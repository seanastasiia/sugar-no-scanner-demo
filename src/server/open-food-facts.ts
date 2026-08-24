import { scoreReferenceProduct } from "@/lib/scoring";
import type { ProductRecord, ProductSource, ScoredProduct } from "@/lib/types";
import { normalizeRetailText, retailerBrandMatches, type BarboraLookupInput } from "./barbora-catalog";

interface OpenFoodFactsNutriments {
  "energy-kcal_100g"?: number;
  "energy-kj_100g"?: number;
  proteins_100g?: number;
  sugars_100g?: number;
  fiber_100g?: number;
}

export interface OpenFoodFactsProduct {
  code: string;
  product_name?: string;
  brands?: string | string[] | null;
  quantity?: string | null;
  nutriments?: OpenFoodFactsNutriments | null;
  image_front_url?: string | null;
  categories?: string | null;
  nutrition_data_per?: string | null;
}

interface SearchResponse {
  hits?: OpenFoodFactsProduct[];
}

interface ProductResponse {
  product?: OpenFoodFactsProduct | null;
  status?: string;
}

interface CanonicalQuantity {
  amount: number;
  dimension: "solid" | "liquid";
}

export interface RankedOpenFoodFactsCandidate {
  product: OpenFoodFactsProduct;
  confidence: number;
}

const SEARCH_URL = "https://search.openfoodfacts.org/search";
const PRODUCT_URL = "https://world.openfoodfacts.org/api/v3/product";
const USER_AGENT = "Sugar.no scanner demo/0.1 (https://sugar.no)";
const CACHE_TTL_MS = 30 * 60_000;
const responseCache = new Map<string, { expiresAt: number; product: ScoredProduct | null; confidence: number }>();

const stopWords = new Set([
  "and",
  "ar",
  "bar",
  "based",
  "bez",
  "drink",
  "food",
  "for",
  "from",
  "high",
  "in",
  "low",
  "made",
  "of",
  "product",
  "protein",
  "sugar",
  "the",
  "un",
  "with"
]);

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function brandText(product: OpenFoodFactsProduct): string {
  if (Array.isArray(product.brands)) return product.brands.join(" ");
  return product.brands || "";
}

function meaningfulTokens(value: string, excluded: Set<string> = new Set()): string[] {
  return [
    ...new Set(
      normalizeRetailText(value)
        .split(" ")
        .filter((token) => token.length >= 3 && !stopWords.has(token) && !excluded.has(token))
    )
  ];
}

function canonicalQuantity(value: string | null | undefined): CanonicalQuantity | null {
  if (!value) return null;
  const normalized = normalizeRetailText(value);
  const multi = normalized.match(/(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/i);
  const single = normalized.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/i);
  const match = multi || single;
  if (!match) return null;
  const multiplier = multi ? Number.parseFloat(match[1]) : 1;
  const numeric = Number.parseFloat(match[multi ? 2 : 1].replace(",", "."));
  const unit = match[multi ? 3 : 2].toLowerCase();
  if (!Number.isFinite(multiplier) || !Number.isFinite(numeric)) return null;
  const factor = unit === "kg" || unit === "l" ? 1_000 : unit === "cl" ? 10 : 1;
  return {
    amount: multiplier * numeric * factor,
    dimension: unit === "ml" || unit === "cl" || unit === "l" ? "liquid" : "solid"
  };
}

function quantityMatches(observed: string, candidate: string | null | undefined): boolean | null {
  const left = canonicalQuantity(observed);
  const right = canonicalQuantity(candidate);
  if (!left || !right) return null;
  if (left.dimension !== right.dimension) return false;
  return Math.abs(left.amount - right.amount) / Math.max(left.amount, right.amount) <= 0.04;
}

function tokenCoverage(query: string[], candidate: string[]): number {
  if (!query.length || !candidate.length) return 0;
  const candidateSet = new Set(candidate);
  return query.filter((token) => candidateSet.has(token)).length / query.length;
}

export function rankOpenFoodFactsCandidates(
  input: BarboraLookupInput,
  candidates: OpenFoodFactsProduct[]
): RankedOpenFoodFactsCandidate[] {
  const observedBrandTokens = new Set(meaningfulTokens(input.brand));
  const observedNameTokens = meaningfulTokens(
    [input.name, input.variant, ...input.searchTerms].filter(Boolean).join(" "),
    observedBrandTokens
  );

  return candidates
    .flatMap((product): RankedOpenFoodFactsCandidate[] => {
      const candidateBrand = brandText(product);
      if (!candidateBrand || !retailerBrandMatches(input.brand, candidateBrand)) return [];
      const candidateNameTokens = meaningfulTokens(product.product_name || "", observedBrandTokens);
      const nameCoverage = tokenCoverage(observedNameTokens, candidateNameTokens);
      const reverseCoverage = tokenCoverage(candidateNameTokens, observedNameTokens);
      const nameScore = Math.max(nameCoverage, reverseCoverage * 0.9);
      const packMatch = input.packSize ? quantityMatches(input.packSize, product.quantity) : null;
      if (packMatch === false) return [];
      const hasNutrition =
        finite(product.nutriments?.proteins_100g) !== null &&
        finite(product.nutriments?.sugars_100g) !== null &&
        (finite(product.nutriments?.["energy-kcal_100g"]) !== null ||
          finite(product.nutriments?.["energy-kj_100g"]) !== null);
      if (!hasNutrition || nameScore < 0.58) return [];
      const confidence = Math.min(1, 0.28 + nameScore * 0.52 + (packMatch === true ? 0.2 : 0.04));
      return [{ product, confidence }];
    })
    .sort((left, right) => right.confidence - left.confidence || left.product.code.localeCompare(right.product.code));
}

function sourceFields(record: ProductRecord): ProductSource["fields"] {
  const fields: ProductSource["fields"] = ["identity"];
  if (record.nutrientsPer100g.proteinG !== null) fields.push("protein");
  if (record.nutrientsPer100g.totalSugarG !== null) fields.push("totalSugar");
  return fields;
}

export function openFoodFactsToScoredProduct(
  product: OpenFoodFactsProduct,
  checkedAt = new Date().toISOString()
): ScoredProduct | null {
  const protein = finite(product.nutriments?.proteins_100g);
  const sugar = finite(product.nutriments?.sugars_100g);
  const kcal = finite(product.nutriments?.["energy-kcal_100g"]);
  const kilojoules = finite(product.nutriments?.["energy-kj_100g"]);
  const energyKcal = kcal ?? (kilojoules === null ? null : Math.round((kilojoules / 4.184) * 10) / 10);
  if (!product.code || !product.product_name || protein === null || sugar === null || energyKcal === null) return null;
  const quantity = canonicalQuantity(product.quantity);
  const sourceUrl = `https://world.openfoodfacts.org/product/${product.code}`;
  const record: ProductRecord = {
    id: `off:${product.code}`,
    retailerProductId: product.code,
    brand: brandText(product) || "Open Food Facts",
    name: product.product_name,
    shortName: product.product_name,
    aliases: [],
    format: "other",
    category: product.categories || null,
    packSizeG: quantity?.amount || 0,
    nutritionBasis:
      product.nutrition_data_per === "100ml" || quantity?.dimension === "liquid" ? "100ml" : "100g",
    energyKcalPer100: energyKcal,
    gtin: product.code,
    nutrientsPer100g: {
      proteinG: protein,
      fiberG: finite(product.nutriments?.fiber_100g),
      totalSugarG: sugar
    },
    noAddedSugarClaim: false,
    imageUrl: product.image_front_url || null,
    retailerUrl: sourceUrl,
    sources: [],
    isGolden: false,
    accent: "coral"
  };
  record.sources = [
    {
      label: "Open Food Facts product record",
      url: sourceUrl,
      checkedAt,
      fields: sourceFields(record),
      status: "secondary"
    }
  ];
  return scoreReferenceProduct(record, "open_food_facts_reference", "open_food_facts_reference_partial");
}

async function fetchByBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
  if (!/^\d{8,14}$/.test(barcode)) return null;
  const fields = "code,product_name,brands,quantity,nutriments,image_front_url,categories,nutrition_data_per";
  const response = await fetch(`${PRODUCT_URL}/${barcode}?fields=${fields}`, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(4_000)
  });
  if (!response.ok) return null;
  const body = (await response.json()) as ProductResponse;
  return body.product || null;
}

async function searchProducts(input: BarboraLookupInput): Promise<OpenFoodFactsProduct[]> {
  const query = [input.brand, input.name, input.variant, input.packSize].filter(Boolean).join(" ");
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify({
      q: query,
      page_size: 30,
      fields: [
        "code",
        "product_name",
        "brands",
        "quantity",
        "nutriments",
        "image_front_url",
        "categories",
        "nutrition_data_per"
      ]
    }),
    signal: AbortSignal.timeout(4_000)
  });
  if (!response.ok) return [];
  return ((await response.json()) as SearchResponse).hits || [];
}

export async function getOpenFoodFactsProductByBarcode(barcode: string): Promise<ScoredProduct | null> {
  const cacheKey = `barcode:${barcode}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.product;
  const product = await fetchByBarcode(barcode).catch(() => null);
  const scored = product ? openFoodFactsToScoredProduct(product) : null;
  responseCache.set(cacheKey, { product: scored, confidence: scored ? 1 : 0, expiresAt: Date.now() + CACHE_TTL_MS });
  return scored;
}

export async function resolveOpenFoodFactsProduct(
  input: BarboraLookupInput,
  barcode = ""
): Promise<{ product: ScoredProduct; confidence: number } | null> {
  if (/^\d{8,14}$/.test(barcode)) {
    const product = await getOpenFoodFactsProductByBarcode(barcode);
    if (product && retailerBrandMatches(input.brand, product.brand)) return { product, confidence: 1 };
  }
  const cacheKey = `search:${normalizeRetailText([input.brand, input.name, input.packSize].join(" "))}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.product ? { product: cached.product, confidence: cached.confidence } : null;
  }
  const ranked = rankOpenFoodFactsCandidates(input, await searchProducts(input).catch(() => []));
  const best = ranked[0];
  const exact = Boolean(best && best.confidence >= 0.84 && best.confidence - (ranked[1]?.confidence || 0) >= 0.08);
  const product = exact ? openFoodFactsToScoredProduct(best.product) : null;
  responseCache.set(cacheKey, {
    product,
    confidence: product ? best.confidence : 0,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
  return product ? { product, confidence: best.confidence } : null;
}
