import livinSnapshot from "../../data/livin-catalog.generated.json";
import rimiSnapshot from "../../data/rimi-catalog.generated.json";
import { scoreReferenceProduct } from "@/lib/scoring";
import type { ProductRecord, RetailerOffer, ScoredProduct } from "@/lib/types";
import { normalizeRetailText, retailerBrandMatches, type BarboraLookupInput } from "./barbora-catalog";
import type { ExternalCatalogProduct } from "./external-catalog-types";

interface RankedExternalCatalogCandidate {
  product: ExternalCatalogProduct;
  confidence: number;
}

const products = [...(rimiSnapshot as ExternalCatalogProduct[]), ...(livinSnapshot as ExternalCatalogProduct[])];
const stopWords = new Set(["and", "ar", "bar", "bez", "for", "from", "in", "of", "the", "un", "with"]);

function canonicalPack(value: string | null | undefined): { amount: number; dimension: "solid" | "liquid" } | null {
  if (!value) return null;
  const normalized = normalizeRetailText(value).replaceAll(",", ".");
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

function tokens(value: string, excluded: Set<string> = new Set()): string[] {
  return [
    ...new Set(
      normalizeRetailText(value)
        .split(" ")
        .filter((token) => token.length >= 3 && !stopWords.has(token) && !excluded.has(token))
    )
  ];
}

function coverage(query: string[], candidate: string[]): number {
  if (!query.length || !candidate.length) return 0;
  const set = new Set(candidate);
  return query.filter((token) => set.has(token)).length / query.length;
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
      const nameScore = Math.max(coverage(queryTokens, candidateTokens), coverage(candidateTokens, queryTokens) * 0.9);
      const candidatePack = canonicalPack(product.packSize);
      const packMatches = observedPack && candidatePack
        ? observedPack.dimension === candidatePack.dimension &&
          Math.abs(observedPack.amount - candidatePack.amount) / Math.max(observedPack.amount, candidatePack.amount) <= 0.04
        : null;
      if (packMatches === false || nameScore < 0.6) return [];
      const confidence = Math.min(1, 0.28 + nameScore * 0.52 + (packMatches ? 0.2 : 0.04));
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
    nutrientsPer100g: { proteinG: product.proteinG, fiberG: null, totalSugarG: product.totalSugarG },
    noAddedSugarClaim: false,
    imageUrl: product.imageUrl,
    retailerUrl: product.url,
    sources: [
      {
        label: `${product.retailer || product.source} Latvia product-page snapshot`,
        url: product.url,
        checkedAt: product.checkedAt,
        fields: ["identity", "protein", "totalSugar", "retailerUrl"],
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

export function externalCatalogCounts() {
  return products.reduce(
    (counts, product) => {
      if (product.source === "rimi_lv" || product.source === "livin_lv") counts[product.source] += 1;
      return counts;
    },
    { rimi_lv: 0, livin_lv: 0 } as Record<"rimi_lv" | "livin_lv", number>
  );
}
