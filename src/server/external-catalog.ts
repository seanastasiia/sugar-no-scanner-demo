import livinSnapshot from "../../data/livin-catalog.generated.json";
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
import type { ExternalCatalogProduct } from "./external-catalog-types";

interface RankedExternalCatalogCandidate {
  product: ExternalCatalogProduct;
  confidence: number;
}

const rawProducts = [...(rimiSnapshot as ExternalCatalogProduct[]), ...(livinSnapshot as ExternalCatalogProduct[])];
const stopWords = new Set(["and", "ar", "bar", "bez", "for", "from", "in", "of", "the", "un", "with"]);
const identityPhraseAliases: Array<[RegExp, string]> = [
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
  if (product.gtin) return `${product.source}:gtin:${product.gtin}`;
  const pack = canonicalPack(product.packSize);
  const packKey = pack ? `${pack.dimension}:${pack.amount}` : normalizeRetailText(product.packSize);
  return [
    product.source,
    normalizeRetailText(product.brand).replaceAll(" ", ""),
    normalizeRetailText(product.title),
    packKey
  ].join(":");
}

function candidatePriority(product: ExternalCatalogProduct): number {
  return (product.available === true ? 8 : product.available === null ? 2 : 0) +
    (product.gtin ? 4 : 0) +
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

const products = dedupeExternalCatalogProducts(rawProducts);
let scoredProducts: ScoredProduct[] | null = null;

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
      const candidateTokens = tokens(product.title, brandTokens);
      const nameScore = balancedCoverage(queryTokens, candidateTokens);
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
    retailerProductId: product.sourceProductId,
    brand: product.brand,
    name: product.title,
    shortName: product.title,
    aliases: [],
    format: "other",
    category: product.category,
    packSizeG: pack?.amount || 1,
    nutritionBasis: product.nutritionBasis,
    energyKcalPer100: product.energyKcal,
    gtin: product.gtin,
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
        label: `${product.retailer || product.source} Latvia product-page snapshot`,
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
  return scoreReferenceProduct(record, "retailer_catalog_reference", "retailer_catalog_reference_partial");
}

function offerFor(product: ExternalCatalogProduct, confidence: number): RetailerOffer | null {
  if (!product.retailer || product.price === null || product.currency !== "EUR" || product.available === false) return null;
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
  if (/^\d{8,14}$/.test(barcode)) {
    const exact = products.find((product) => product.gtin === barcode);
    if (exact && retailerBrandMatches(input.brand, exact.brand)) {
      return { product: externalCatalogToScoredProduct(exact), confidence: 1, offer: offerFor(exact, 1) };
    }
  }
  const ranked = rankExternalCatalogCandidates(input);
  const best = ranked[0];
  if (!best || best.confidence < 0.84 || best.confidence - (ranked[1]?.confidence || 0) < 0.08) return null;
  return {
    product: externalCatalogToScoredProduct(best.product),
    confidence: best.confidence,
    offer: offerFor(best.product, best.confidence)
  };
}

export function getExternalCatalogProductByBarcode(
  barcode: string
): { product: ScoredProduct; confidence: 1; offer: RetailerOffer | null } | null {
  if (!/^\d{8,14}$/.test(barcode)) return null;
  const exact = products.find((product) => product.gtin === barcode);
  return exact
    ? { product: externalCatalogToScoredProduct(exact), confidence: 1, offer: offerFor(exact, 1) }
    : null;
}

export function listExternalCatalogScoredProducts(): ScoredProduct[] {
  if (!scoredProducts) scoredProducts = products.map(externalCatalogToScoredProduct);
  return scoredProducts;
}

export function getExternalCatalogProductById(id: string): ScoredProduct | null {
  const [source, sourceProductId] = id.split(":", 2);
  if ((source !== "rimi_lv" && source !== "livin_lv") || !sourceProductId) return null;
  const product = products.find(
    (candidate) => candidate.source === source && candidate.sourceProductId === sourceProductId
  );
  return product ? externalCatalogToScoredProduct(product) : null;
}

export function getExternalCatalogOfferByKey(key: string): RetailerOffer | null {
  const [source, sourceProductId] = key.split(":", 2);
  if ((source !== "rimi_lv" && source !== "livin_lv") || !sourceProductId) return null;
  const product = products.find(
    (candidate) => candidate.source === source && candidate.sourceProductId === sourceProductId
  );
  return product ? offerFor(product, 1) : null;
}

export function externalCatalogCounts() {
  return products.reduce(
    (counts, product) => {
      if (product.source === "rimi_lv" || product.source === "livin_lv") counts[product.source] += 1;
      return counts;
    },
    { rimi_lv: 0, livin_lv: 0 } as Record<"rimi_lv" | "livin_lv", number>
  );
}
