import livinSnapshot from "../../data/livin-catalog.generated.json";
import livinnFoodIndex from "../../data/livinn-food-index.generated.json";
import livinnSnapshot from "../../data/livinn-catalog.generated.json";
import rimiSnapshot from "../../data/rimi-catalog.generated.json";
import { scoreReferenceProduct } from "@/lib/scoring";
import type { ProductRecord, RetailerOffer, ScoredProduct } from "@/lib/types";
import {
  normalizeRetailQuantityText,
  normalizeRetailText,
  retailIdentityTokenMatches,
  retailerBrandMatches,
  type BarboraLookupInput
} from "./barbora-catalog";
import type { ExternalCatalogIdentity, ExternalCatalogProduct } from "./external-catalog-types";
import { isQuarantinedRetailerNutrition } from "./retailer-nutrition-quarantine";
import { getShelfEvidence } from "./personal-shelf-evidence";
import { applyShelfNutritionTrustGuard } from "@/lib/personal-shelf-rank";
import { isReviewedPackageAlias, withReviewedPackageAliases } from "./reviewed-package-aliases";
import { validWebGtin } from "./web-product-evidence";

interface RankedExternalCatalogCandidate {
  product: ExternalCatalogProduct;
  confidence: number;
}

const safeGtin = (value: string | null): string | null => validWebGtin(value) ? value : null;

const rawProducts = [
  ...(rimiSnapshot as ExternalCatalogProduct[]),
  ...(livinSnapshot as ExternalCatalogProduct[]),
  ...(livinnSnapshot as ExternalCatalogProduct[])
];
const stopWords = new Set(["and", "ar", "bar", "bez", "for", "from", "in", "of", "the", "un", "with"]);
const identityPhraseAliases: Array<[RegExp, string]> = [
  [/\bbrown rice cakes?\b/g, "risu galetes"],
  [/\bhimalayan salt\b/g, "himalaju sali"],
  [/\bgluten free\b/g, "bez glutena"],
  [/\brosemary\b/g, "rozmarinu"],
  [/\bpastry twists? salty\b/g, "salsstandzinas"],
  [/\bsalty pastry twists?\b/g, "salsstandzinas"],
  [/\bpastry twists? cheese\b/g, "salsstandzinas siers"],
  [/\bcheese pastry twists?\b/g, "salsstandzinas siers"],
  [/\bmulti fruit\b/g, "multiauglu"],
  [/\bmultifruit\b/g, "multiauglu"],
  [/\bsolen(?:ye|yi|aia) palochki\b/g, "salsstandzinas"],
  [/\bsyrn(?:ye|yi|aia) palochki\b/g, "salsstandzinas siers"],
  [/\bmultifruktovyi (?:napitok|sok)\b/g, "multiauglu sula"],
  [/\bklubnichno bananovyi (?:napitok|sok)\b/g, "zemenu bananu sula"]
];
const identityTokenAliases: Record<string, string> = {
  banana: "bananu",
  banan: "bananu",
  cheese: "siers",
  chesnok: "kiploku",
  chernika: "mellenu",
  desert: "deserts",
  drink: "dzeriens",
  drinks: "dzeriens",
  iogurt: "jogurts",
  juice: "sula",
  karamel: "karamelu",
  klubnika: "zemenu",
  kokos: "kokosriekstu",
  maionez: "majoneze",
  malina: "avenu",
  moloko: "piens",
  pechene: "cepumi",
  persik: "persiku",
  puding: "pudins",
  shokolad: "sokolades",
  siera: "siers",
  sieru: "siers",
  syr: "siers",
  strawberry: "zemenu",
  sulas: "sula",
  sulu: "sula",
  tunets: "tunzivs",
  tvorog: "biezpiens",
  vanil: "vanilas",
  vishnia: "kirsu"
};

function canonicalPack(value: string | null | undefined): { amount: number; dimension: "solid" | "liquid" } | null {
  if (!value) return null;
  const normalized = normalizeRetailQuantityText(value);
  const multi = normalized.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l)\b/i);
  const single = normalized.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l)\b/i);
  const match = multi || single;
  if (!match) return null;
  const count = multi ? Number.parseInt(match[1], 10) : 1;
  const amount = Number.parseFloat(match[multi ? 2 : 1]);
  const unit = match[multi ? 3 : 2];
  const factor = unit === "kg" || unit === "l" ? 1_000 : unit === "cl" ? 10 : 1;
  return {
    amount: count * amount * factor,
    dimension: unit === "ml" || unit === "cl" || unit === "l" ? "liquid" : "solid"
  };
}

function dedupeIdentityKey(product: ExternalCatalogProduct): string {
  const gtin = safeGtin(product.gtin);
  if (gtin) return `${product.source}:gtin:${gtin}`;
  const pack = canonicalPack(product.packSize);
  const packKey = pack ? `${pack.dimension}:${pack.amount}` : normalizeRetailText(product.packSize);
  // Invalid source numbers do not participate. Fall back to the existing
  // conservative within-retailer identity; this is never a cross-source merge.
  return [
    product.source,
    normalizeRetailText(product.brand).replaceAll(" ", ""),
    normalizeRetailText(product.title),
    packKey
  ].join(":");
}

function candidatePriority(product: ExternalCatalogProduct): number {
  return (product.available === true ? 8 : product.available === null ? 2 : 0) +
    (safeGtin(product.gtin) ? 4 : 0) +
    (product.imageUrl ? 2 : 0) +
    (product.price !== null ? 1 : 0);
}

export function dedupeExternalCatalogProducts(candidates: ExternalCatalogProduct[]): ExternalCatalogProduct[] {
  const deduped = new Map<string, ExternalCatalogProduct>();
  for (const candidate of candidates) {
    const key = dedupeIdentityKey(candidate);
    const current = deduped.get(key);
    if (
      !current ||
      candidatePriority(candidate) > candidatePriority(current) ||
      (candidatePriority(candidate) === candidatePriority(current) && candidate.checkedAt > current.checkedAt) ||
      (candidatePriority(candidate) === candidatePriority(current) &&
        candidate.checkedAt === current.checkedAt &&
        candidate.sourceProductId.localeCompare(current.sourceProductId) < 0)
    ) {
      deduped.set(key, candidate);
    }
  }
  return [...deduped.values()].sort((left, right) => left.sourceProductId.localeCompare(right.sourceProductId));
}

const products = dedupeExternalCatalogProducts(rawProducts.map(withReviewedPackageAliases));
const identities = (livinnFoodIndex as ExternalCatalogIdentity[]).map(withReviewedPackageAliases);

function barcodeIndex<T extends { gtin: string | null }>(values: T[]): Map<string, T> {
  const index = new Map<string, T>();
  for (const value of values) {
    const canonical = validWebGtin(value.gtin);
    if (!canonical) continue;
    if (!index.has(value.gtin!)) index.set(value.gtin!, value);
    if (!index.has(canonical)) index.set(canonical, value);
  }
  return index;
}

const productsByBarcode = barcodeIndex(products);
const identitiesByBarcode = barcodeIndex(identities);
const productsById = new Map<string, ExternalCatalogProduct>(
  products.map((product) => [`${product.source}:${product.sourceProductId}`, product])
);
const identitiesById = new Map<string, ExternalCatalogIdentity>(
  identities.map((product) => [`${product.source}:${product.sourceProductId}`, product])
);

function brandIndex<T extends { brand: string }>(values: T[]): Map<string, T[]> {
  const index = new Map<string, T[]>();
  for (const value of values) {
    const key = normalizeRetailText(value.brand).replaceAll(" ", "");
    index.set(key, [...(index.get(key) || []), value]);
  }
  return index;
}

const productsByBrand = brandIndex(products);
const identitiesByBrand = brandIndex(identities);
let scoredProducts: ScoredProduct[] | null = null;

function indexedBrandCandidates<T>(inputBrand: string, index: Map<string, T[]>, fallback: T[]): T[] {
  const key = normalizeRetailText(inputBrand).replaceAll(" ", "");
  return index.get(key) || fallback;
}

function tokens(value: string, excluded: Set<string> = new Set()): string[] {
  const normalized = identityPhraseAliases.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    normalizeRetailText(value)
  );
  return [
    ...new Set(
      normalized
        .split(" ")
        .map((token) => identityTokenAliases[token] || token)
        .filter((token) =>
          token.length >= 3 &&
          !/^\d+(?:\.\d+)?(?:kg|g|ml|cl|l)$/.test(token) &&
          !stopWords.has(token) &&
          !excluded.has(token)
        )
    )
  ];
}

function coverage(query: string[], candidate: string[]): number {
  if (!query.length || !candidate.length) return 0;
  return query.filter((token) =>
    candidate.some((candidateToken) => retailIdentityTokenMatches(token, candidateToken))
  ).length / query.length;
}

function balancedCoverage(query: string[], candidate: string[]): number {
  const queryCoverage = coverage(query, candidate);
  const candidateCoverage = coverage(candidate, query);
  if (!queryCoverage || !candidateCoverage) return 0;
  return (2 * queryCoverage * candidateCoverage) / (queryCoverage + candidateCoverage);
}

function aliasCoverage(query: string[], name: string, excluded: Set<string>): number {
  const candidate = tokens(name, excluded);
  if (!isReviewedPackageAlias(name)) return balancedCoverage(query, candidate);
  // A reviewed label is not permission to ignore an extra flavour. Allow only
  // generic label words and pack numbers (the separate pack guard checks those).
  const generic = new Set(["organic", "cereal", "cereals", "breakfast"]);
  const clean = (values: string[]) => values.filter((token) => !generic.has(token) && !/^\d+$/.test(token));
  const cleanQuery = clean(query);
  const cleanCandidate = clean(candidate);
  if (coverage(cleanQuery, cleanCandidate) < 1) return 0;
  return balancedCoverage(cleanQuery, cleanCandidate);
}

function packEvidenceBonus(packMatches: boolean | null, nameScore: number): number {
  if (packMatches === true) return 0.2;
  // Protein and sugar are normalized per 100 g / 100 ml, so a missing pack
  // size must not block an otherwise exact, unambiguous product identity.
  // The resolver's candidate-margin check still rejects sibling pack sizes
  // or variants when more than one catalog record is equally plausible.
  if (packMatches === null && nameScore >= 0.9) return 0.12;
  return 0.04;
}

export function rankExternalCatalogCandidates(
  input: BarboraLookupInput,
  candidates: ExternalCatalogProduct[] = products
): RankedExternalCatalogCandidate[] {
  const brandTokens = new Set(tokens(input.brand));
  const queryTokens = tokens([input.name, input.variant, ...input.searchTerms].filter(Boolean).join(" "), brandTokens);
  const observedPack = canonicalPack(input.packSize);
  return candidates
    .flatMap((product): RankedExternalCatalogCandidate[] => {
      if (!retailerBrandMatches(input.brand, product.brand)) return [];
      const nameScore = [product.title, ...(product.aliases || [])].reduce(
        (best, name) => Math.max(best, aliasCoverage(queryTokens, name, brandTokens)),
        0
      );
      const candidatePack = canonicalPack(product.packSize);
      const packMatches = observedPack && candidatePack
        ? observedPack.dimension === candidatePack.dimension &&
          Math.abs(observedPack.amount - candidatePack.amount) / Math.max(observedPack.amount, candidatePack.amount) <= 0.04
        : null;
      if (packMatches === false || nameScore < 0.6) return [];
      const confidence = Math.min(1, 0.28 + nameScore * 0.52 + packEvidenceBonus(packMatches, nameScore));
      return [{ product, confidence }];
    })
    .sort((left, right) => right.confidence - left.confidence || left.product.sourceProductId.localeCompare(right.product.sourceProductId));
}

export function rankExternalCatalogIdentities(
  input: BarboraLookupInput,
  candidates: ExternalCatalogIdentity[] = identities
): Array<{ product: ExternalCatalogIdentity; confidence: number }> {
  const brandTokens = new Set(tokens(input.brand));
  const queryTokens = tokens([input.name, input.variant, ...input.searchTerms].filter(Boolean).join(" "), brandTokens);
  const observedPack = canonicalPack(input.packSize);
  return candidates
    .flatMap((product) => {
      if (!retailerBrandMatches(input.brand, product.brand)) return [];
      const nameScore = [product.title, ...product.aliases].reduce(
        (best, name) => Math.max(best, aliasCoverage(queryTokens, name, brandTokens)),
        0
      );
      const candidatePack = canonicalPack(product.packSize);
      const packMatches = observedPack && candidatePack
        ? observedPack.dimension === candidatePack.dimension &&
          Math.abs(observedPack.amount - candidatePack.amount) / Math.max(observedPack.amount, candidatePack.amount) <= 0.04
        : null;
      if (packMatches === false || nameScore < 0.6) return [];
      const confidence = Math.min(1, 0.28 + nameScore * 0.52 + packEvidenceBonus(packMatches, nameScore));
      return [{ product, confidence }];
    })
    .sort((left, right) => right.confidence - left.confidence || left.product.sourceProductId.localeCompare(right.product.sourceProductId));
}

export function externalCatalogToScoredProduct(product: ExternalCatalogProduct): ScoredProduct {
  const pack = canonicalPack(product.packSize);
  const record: ProductRecord = {
    id: `${product.source}:${product.sourceProductId}`,
    shelfEvidence: product.shelfEvidence || getShelfEvidence(`${product.source}:${product.sourceProductId}`),
    retailerProductId: product.sourceProductId,
    brand: product.brand,
    name: product.title,
    shortName: product.title,
    aliases: product.aliases || [],
    format: "other",
    category: product.category,
    packSizeG: pack?.amount || 1,
    nutritionBasis: product.nutritionBasis,
    energyKcalPer100: product.energyKcal,
    gtin: safeGtin(product.gtin),
    nutrientsPer100g: {
      proteinG: product.proteinG,
      fiberG: null,
      totalSugarG: product.totalSugarG,
      carbohydrateG: product.carbohydrateG ?? null
    },
    noAddedSugarClaim: false,
    imageUrl: product.imageUrl,
    retailerUrl: product.url,
    sources: [
      {
        label: product.source === "livinn_lt"
          ? "Livinn Lithuania product-page snapshot"
          : `${product.retailer || product.source} Latvia product-page snapshot`,
        url: product.url,
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
  };
  const scored = applyShelfNutritionTrustGuard(scoreReferenceProduct(record, "retailer_catalog_reference", "retailer_catalog_reference_partial"));
  if (!isQuarantinedRetailerNutrition(product)) return scored;
  return {
    ...scored,
    matchScore: null,
    matchReason: "missing_nutrition",
    ratingStatus: "identity_only",
    ratingSignalCount: 0,
    ratingSignalMask: [],
    criterionScores: null,
    nutrientsPer100g: { proteinG: null, totalSugarG: null, fiberG: null, carbohydrateG: null }
  };
}

export function externalCatalogIdentityToScoredProduct(product: ExternalCatalogIdentity): ScoredProduct {
  const pack = canonicalPack(product.packSize);
  const record: ProductRecord = {
    id: `${product.source}:${product.sourceProductId}`,
    shelfEvidence: getShelfEvidence(`${product.source}:${product.sourceProductId}`),
    retailerProductId: product.sourceProductId,
    brand: product.brand,
    name: product.title,
    shortName: product.title,
    aliases: product.aliases,
    format: "other",
    category: product.category,
    packSizeG: pack?.amount || 1,
    nutritionBasis: pack?.dimension === "liquid" ? "100ml" : "100g",
    energyKcalPer100: null,
    gtin: safeGtin(product.gtin),
    nutrientsPer100g: {
      proteinG: null,
      fiberG: null,
      totalSugarG: null,
      carbohydrateG: null
    },
    noAddedSugarClaim: false,
    imageUrl: product.imageUrl,
    retailerUrl: product.url,
    sources: [
      {
        label: "Livinn Lithuania product identity",
        url: product.url,
        checkedAt: product.checkedAt,
        fields: ["identity", "retailerUrl"],
        status: "secondary"
      }
    ],
    isGolden: false,
    accent: "coral"
  };
  return scoreReferenceProduct(record, "retailer_catalog_reference", "retailer_catalog_reference_partial");
}

function offerFor(product: ExternalCatalogProduct, confidence: number): RetailerOffer | null {
  if (
    product.source === "livinn_lt" ||
    !product.retailer ||
    product.price === null ||
    product.currency !== "EUR" ||
    product.available === false
  ) return null;
  return {
    retailer: product.retailer,
    slug: `${product.source}:${product.sourceProductId}`,
    title: product.title,
    brand: product.brand,
    url: product.url,
    price: product.price,
    currency: "EUR",
    unitPrice: null,
    unit: null,
    imageUrl: product.imageUrl,
    checkedAt: product.checkedAt,
    matchConfidence: confidence,
    exactSku: true
  };
}

export function resolveExternalCatalogProduct(
  input: BarboraLookupInput,
  barcode = ""
): { product: ScoredProduct; confidence: number; offer: RetailerOffer | null } | null {
  const canonicalBarcode = validWebGtin(barcode);
  if (canonicalBarcode) {
    const exact = productsByBarcode.get(barcode) || productsByBarcode.get(canonicalBarcode);
    if (exact && retailerBrandMatches(input.brand, exact.brand)) {
      return { product: externalCatalogToScoredProduct(exact), confidence: 1, offer: offerFor(exact, 1) };
    }
  }
  const ranked = rankExternalCatalogCandidates(input, indexedBrandCandidates(input.brand, productsByBrand, products));
  const best = ranked[0];
  if (!best || best.confidence < 0.84 || best.confidence - (ranked[1]?.confidence || 0) < 0.08) return null;
  return {
    product: externalCatalogToScoredProduct(best.product),
    confidence: best.confidence,
    offer: offerFor(best.product, best.confidence)
  };
}

export function resolveExternalCatalogIdentity(
  input: BarboraLookupInput,
  barcode = ""
): { identity: ExternalCatalogIdentity; product: ScoredProduct; confidence: number } | null {
  const canonicalBarcode = validWebGtin(barcode);
  if (canonicalBarcode) {
    const exact = identitiesByBarcode.get(barcode) || identitiesByBarcode.get(canonicalBarcode);
    if (exact && retailerBrandMatches(input.brand, exact.brand)) {
      return { identity: exact, product: externalCatalogIdentityToScoredProduct(exact), confidence: 1 };
    }
  }
  const ranked = rankExternalCatalogIdentities(input, indexedBrandCandidates(input.brand, identitiesByBrand, identities));
  const best = ranked[0];
  if (!best || best.confidence < 0.84 || best.confidence - (ranked[1]?.confidence || 0) < 0.08) return null;
  return {
    identity: best.product,
    product: externalCatalogIdentityToScoredProduct(best.product),
    confidence: best.confidence
  };
}

export function getExternalCatalogProductByBarcode(
  barcode: string
): { product: ScoredProduct; confidence: 1; offer: RetailerOffer | null } | null {
  const canonical = validWebGtin(barcode);
  if (!canonical) return null;
  const exact = productsByBarcode.get(barcode) || productsByBarcode.get(canonical);
  return exact
    ? { product: externalCatalogToScoredProduct(exact), confidence: 1, offer: offerFor(exact, 1) }
    : null;
}

export function getExternalCatalogIdentityByBarcode(barcode: string): ScoredProduct | null {
  const canonical = validWebGtin(barcode);
  if (!canonical) return null;
  const identity = identitiesByBarcode.get(barcode) || identitiesByBarcode.get(canonical);
  return identity ? externalCatalogIdentityToScoredProduct(identity) : null;
}

export function listExternalCatalogScoredProducts(): ScoredProduct[] {
  if (!scoredProducts) scoredProducts = products.map(externalCatalogToScoredProduct);
  return scoredProducts;
}

export function getExternalCatalogProductById(id: string): ScoredProduct | null {
  const [source, sourceProductId] = id.split(":", 2);
  if ((source !== "rimi_lv" && source !== "livin_lv" && source !== "livinn_lt") || !sourceProductId) return null;
  const product = productsById.get(id);
  if (product) return externalCatalogToScoredProduct(product);
  const identity = identitiesById.get(id);
  return identity ? externalCatalogIdentityToScoredProduct(identity) : null;
}

export function getExternalCatalogOfferByKey(key: string): RetailerOffer | null {
  const [source, sourceProductId] = key.split(":", 2);
  if ((source !== "rimi_lv" && source !== "livin_lv") || !sourceProductId) return null;
  const product = productsById.get(key);
  return product ? offerFor(product, 1) : null;
}

export function externalCatalogCounts() {
  return products.reduce(
    (counts, product) => {
      if (!isQuarantinedRetailerNutrition(product) && (product.source === "rimi_lv" || product.source === "livin_lv" || product.source === "livinn_lt")) {
        counts[product.source] += 1;
      }
      return counts;
    },
    { rimi_lv: 0, livin_lv: 0, livinn_lt: 0 } as Record<"rimi_lv" | "livin_lv" | "livinn_lt", number>
  );
}

export function externalCatalogIdentityCount(): number {
  return identities.length;
}
