import { scoreReferenceProduct } from "@/lib/scoring";
import type { ProductRecord, ProductSource, ScoredProduct } from "@/lib/types";
import bulkSnapshot from "../../data/open-food-facts-lv.generated.json";
import regionalBulkSnapshot from "../../data/open-food-facts-regional.generated.json";
import type { ExternalCatalogProduct } from "./external-catalog-types";
import { openFoodFactsProductNames } from "./open-food-facts-bulk";
import { offShelfEvidence } from "./personal-shelf-parser";
import {
  normalizeRetailQuantityText,
  normalizeRetailText,
  retailIdentityTokenMatches,
  retailerBrandMatches,
  type BarboraLookupInput
} from "./barbora-catalog";

interface OpenFoodFactsNutriments {
  "energy-kcal_100g"?: number;
  "energy-kj_100g"?: number;
  proteins_100g?: number;
  sugars_100g?: number;
  carbohydrates_100g?: number;
  fiber_100g?: number;
  salt_100g?: number;
  sodium_100g?: number;
  "saturated-fat_100g"?: number;
}

export interface OpenFoodFactsProduct {
  [key: string]: unknown;
  code: string;
  product_name?: string;
  product_name_lv?: string;
  product_name_en?: string;
  product_name_ru?: string;
  product_names?: string[];
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

interface RankedOpenFoodFactsCandidate {
  product: OpenFoodFactsProduct;
  confidence: number;
}

const SEARCH_URL = "https://search.openfoodfacts.org/search";
const PRODUCT_URL = "https://world.openfoodfacts.org/api/v3/product";
const USER_AGENT = "Sugar.no scanner demo/0.1 (https://sugar.no)";
const CACHE_TTL_MS = 30 * 60_000;
const responseCache = new Map<string, { expiresAt: number; product: ScoredProduct | null; confidence: number }>();
const bulkProducts = [
  ...new Map(
    [...(bulkSnapshot as ExternalCatalogProduct[]), ...(regionalBulkSnapshot as ExternalCatalogProduct[])]
      .map((product) => [product.gtin || product.sourceProductId, product] as const)
  ).values()
];
const bulkProductsByBarcode = new Map(
  bulkProducts.map((product) => [product.gtin || product.sourceProductId, product] as const)
);
const bulkProductsByBrand = new Map<string, ExternalCatalogProduct[]>();
for (const product of bulkProducts) {
  const key = normalizeRetailText(product.brand).replaceAll(" ", "");
  const current = bulkProductsByBrand.get(key) || [];
  current.push(product);
  bulkProductsByBrand.set(key, current);
}
let scoredBulkProducts: ScoredProduct[] | null = null;

const productNameFields = [
  "product_name",
  "product_name_lv",
  "product_name_en",
  "product_name_ru",
  "product_name_lt",
  "product_name_et",
  "product_name_fr",
  "product_name_de",
  "product_name_pl",
  "product_name_bg",
  "product_name_ro",
  "product_name_cs",
  "product_name_es"
] as const;

function productNames(product: OpenFoodFactsProduct): string[] {
  const names = openFoodFactsProductNames(product);
  for (const name of product.product_names || []) {
    const trimmed = name.trim();
    if (trimmed && !names.some((candidate) => normalizeRetailText(candidate) === normalizeRetailText(trimmed))) {
      names.push(trimmed);
    }
  }
  return names;
}

function preferredProductName(product: OpenFoodFactsProduct): string {
  return productNames(product)[0] || "";
}

function bulkProductToOpenFoodFactsProduct(source: ExternalCatalogProduct): OpenFoodFactsProduct {
  return {
    code: source.gtin || source.sourceProductId,
    product_name: source.title,
    product_names: [source.title, ...(source.aliases || [])],
    ingredients_text: source.shelfEvidence?.ingredientsText,
    ingredients_lc: source.shelfEvidence?.ingredientsLanguage,
    brands: source.brand,
    quantity: source.packSize,
    nutrition_data_per: source.nutritionBasis,
    nutriments: {
      "energy-kcal_100g": source.energyKcal,
      proteins_100g: source.proteinG,
      sugars_100g: source.totalSugarG,
      carbohydrates_100g: source.carbohydrateG ?? undefined,
      fiber_100g: source.shelfEvidence?.fiberG ?? undefined,
      salt_100g: source.shelfEvidence?.saltG ?? undefined,
      "saturated-fat_100g": source.shelfEvidence?.saturatedFatG ?? undefined
    },
    image_front_url: source.imageUrl,
    categories: source.category
  };
}

export function getOpenFoodFactsBulkProductByBarcode(barcode: string): ScoredProduct | null {
  if (!/^\d{8,14}$/.test(barcode)) return null;
  const source = bulkProductsByBarcode.get(barcode);
  if (!source) return null;
  return openFoodFactsToScoredProduct(bulkProductToOpenFoodFactsProduct(source), source.checkedAt);
}

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
        .filter((token) =>
          token.length >= 3 &&
          !/^\d+(?:kg|g|ml|cl|l)?$/.test(token) &&
          !stopWords.has(token) &&
          !excluded.has(token)
        )
    )
  ];
}

function canonicalQuantity(value: string | null | undefined): CanonicalQuantity | null {
  if (!value) return null;
  const normalized = normalizeRetailQuantityText(value);
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

function statedPercentage(value: string): number | null {
  const match = value.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*%/i);
  if (!match) return null;
  const percentage = Number.parseFloat(match[1].replace(",", "."));
  return Number.isFinite(percentage) ? percentage : null;
}

function percentageMatches(observed: string, candidate: string): boolean | null {
  const left = statedPercentage(observed);
  const right = statedPercentage(candidate);
  if (left === null || right === null) return null;
  return Math.abs(left - right) <= 0.05;
}

function tokenCoverage(query: string[], candidate: string[]): number {
  if (!query.length || !candidate.length) return 0;
  return query.filter((token) =>
    candidate.some((candidateToken) => retailIdentityTokenMatches(token, candidateToken))
  ).length / query.length;
}

function packEvidenceBonus(packMatch: boolean | null, nameScore: number): number {
  if (packMatch === true) return 0.2;
  // OFF nutrients are already expressed per 100 g / 100 ml. Missing package
  // size is therefore acceptable only for a very strong identity match; an
  // explicit size conflict and ambiguous sibling records still fail closed.
  if (packMatch === null && nameScore >= 0.9) return 0.12;
  return 0.04;
}

export function rankOpenFoodFactsCandidates(
  input: BarboraLookupInput,
  candidates: OpenFoodFactsProduct[]
): RankedOpenFoodFactsCandidate[] {
  const observedIdentity = [input.name, input.variant, ...input.searchTerms].filter(Boolean).join(" ");
  const observedBrandTokens = new Set(meaningfulTokens(input.brand));
  const compactObservedBrand = normalizeRetailText(input.brand).replaceAll(" ", "");
  if (compactObservedBrand.length >= 3) observedBrandTokens.add(compactObservedBrand);
  const observedNameTokens = meaningfulTokens(
    observedIdentity,
    observedBrandTokens
  );

  return candidates
    .flatMap((product): RankedOpenFoodFactsCandidate[] => {
      const candidateBrand = brandText(product);
      if (!candidateBrand || !retailerBrandMatches(input.brand, candidateBrand)) return [];
      const names = productNames(product);
      const nameMatch = names.reduce(
        (best, name) => {
          const candidateNameTokens = meaningfulTokens(name, observedBrandTokens);
          const nameCoverage = tokenCoverage(observedNameTokens, candidateNameTokens);
          const reverseCoverage = tokenCoverage(candidateNameTokens, observedNameTokens);
          const nameScore = nameCoverage && reverseCoverage
            ? (2 * nameCoverage * reverseCoverage) / (nameCoverage + reverseCoverage)
            : 0;
          return nameScore > best.nameScore ? { nameScore, reverseCoverage } : best;
        },
        { nameScore: 0, reverseCoverage: 0 }
      );
      const { nameScore, reverseCoverage } = nameMatch;
      const packMatch = input.packSize ? quantityMatches(input.packSize, product.quantity) : null;
      if (packMatch === false) return [];
      // Fat percentage is part of a dairy SKU. A visible 3.2% pack must not
      // borrow nutrition from a 2% sibling even when translated names such as
      // Milk and Piens correctly match as synonyms.
      const percentageMatchesByName = names
        .map((name) => percentageMatches(observedIdentity, name))
        .filter((match): match is boolean => match !== null);
      if (percentageMatchesByName.length && !percentageMatchesByName.includes(true)) return [];
      const hasNutrition =
        finite(product.nutriments?.proteins_100g) !== null &&
        finite(product.nutriments?.sugars_100g) !== null &&
        (finite(product.nutriments?.["energy-kcal_100g"]) !== null ||
          finite(product.nutriments?.["energy-kj_100g"]) !== null);
      // A specific OFF variant must not inherit nutrition from a shorter,
      // generic camera label (for example, "Immune Support" versus a
      // blueberry SKU). Require candidate-side identity coverage as well as
      // the balanced score before an exact-SKU result can be considered.
      if (!hasNutrition || nameScore < 0.58 || reverseCoverage < 0.72) return [];
      const confidence = Math.min(1, 0.28 + nameScore * 0.52 + packEvidenceBonus(packMatch, nameScore));
      return [{ product, confidence }];
    })
    .sort((left, right) => right.confidence - left.confidence || left.product.code.localeCompare(right.product.code));
}

function sourceFields(record: ProductRecord): ProductSource["fields"] {
  const fields: ProductSource["fields"] = ["identity"];
  if (record.nutrientsPer100g.proteinG !== null) fields.push("protein");
  if (record.nutrientsPer100g.totalSugarG !== null) fields.push("totalSugar");
  if (record.nutrientsPer100g.carbohydrateG !== null && record.nutrientsPer100g.carbohydrateG !== undefined) {
    fields.push("carbohydrate");
  }
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
  const names = productNames(product);
  const name = preferredProductName(product);
  if (!product.code || !name || protein === null || sugar === null || energyKcal === null) return null;
  const quantity = canonicalQuantity(product.quantity);
  const sourceUrl = `https://world.openfoodfacts.org/product/${product.code}`;
  const record: ProductRecord = {
    id: `off:${product.code}`,
    shelfEvidence: offShelfEvidence(product, checkedAt),
    retailerProductId: product.code,
    brand: brandText(product) || "Open Food Facts",
    name,
    shortName: name,
    aliases: names.slice(1),
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
      totalSugarG: sugar,
      carbohydrateG: finite(product.nutriments?.carbohydrates_100g)
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
  const fields = ["code", ...productNameFields, "brands", "quantity", "nutriments", "image_front_url", "categories", "nutrition_data_per", "ingredients_text", "ingredients_lc", "lang", "ingredients_text_en", "ingredients_text_lv", "ingredients_text_lt", "ingredients_text_ru", "ingredients_text_et"].join(",");
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
        ...productNameFields,
        "brands",
        "quantity",
        "nutriments",
        "image_front_url",
        "categories",
        "nutrition_data_per",
        "ingredients_text", "ingredients_lc", "lang",
        "ingredients_text_en", "ingredients_text_lv", "ingredients_text_lt", "ingredients_text_ru", "ingredients_text_et"
      ]
    }),
    signal: AbortSignal.timeout(4_000)
  });
  if (!response.ok) return [];
  return ((await response.json()) as SearchResponse).hits || [];
}

export async function getOpenFoodFactsProductByBarcode(barcode: string): Promise<ScoredProduct | null> {
  const bulkProduct = getOpenFoodFactsBulkProductByBarcode(barcode);
  if (bulkProduct) return bulkProduct;
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
  const normalizedBrand = normalizeRetailText(input.brand).replaceAll(" ", "");
  const bulkCandidates = /^\d{8,14}$/.test(barcode)
    ? [bulkProductsByBarcode.get(barcode)].filter((product): product is ExternalCatalogProduct => Boolean(product))
    : [...bulkProductsByBrand.entries()]
        .filter(([brand]) => brand === normalizedBrand || retailerBrandMatches(input.brand, brand))
        .flatMap(([, products]) => products);
  const rankedBulk = rankOpenFoodFactsCandidates(
    input,
    bulkCandidates.map((product) => ({
      code: product.gtin || product.sourceProductId,
      product_name: product.title,
      product_names: [product.title, ...(product.aliases || [])],
      brands: product.brand,
      quantity: product.packSize,
      nutrition_data_per: product.nutritionBasis,
      nutriments: {
        "energy-kcal_100g": product.energyKcal,
        proteins_100g: product.proteinG,
        sugars_100g: product.totalSugarG,
        carbohydrates_100g: product.carbohydrateG ?? undefined
      },
      image_front_url: product.imageUrl,
      categories: product.category
    }))
  );
  const bestBulk = rankedBulk[0];
  const exactBulk = Boolean(
    bestBulk &&
      (bestBulk.product.code === barcode ||
        (bestBulk.confidence >= 0.84 && bestBulk.confidence - (rankedBulk[1]?.confidence || 0) >= 0.08))
  );
  if (exactBulk) {
    const source = bulkCandidates.find((candidate) => (candidate.gtin || candidate.sourceProductId) === bestBulk.product.code);
    const product = openFoodFactsToScoredProduct(bestBulk.product, source?.checkedAt);
    if (product) return { product, confidence: bestBulk.product.code === barcode ? 1 : bestBulk.confidence };
  }
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

export function openFoodFactsBulkCount(): number {
  return bulkProducts.length;
}

export function listOpenFoodFactsBulkProducts(): ScoredProduct[] {
  if (!scoredBulkProducts) {
    scoredBulkProducts = bulkProducts.flatMap((source) => {
      const product = openFoodFactsToScoredProduct(bulkProductToOpenFoodFactsProduct(source), source.checkedAt);
      return product ? [product] : [];
    });
  }
  return scoredBulkProducts;
}
