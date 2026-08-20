import productSlugs from "../../data/barbora-product-index.generated.json";
import type { RetailerOffer } from "@/lib/types";

export interface BarboraLookupInput {
  brand: string;
  name: string;
  variant: string;
  packSize: string;
  searchTerms: string[];
}

export interface RankedBarboraCandidate {
  slug: string;
  score: number;
}

const stopWords = new Set([
  "a",
  "added",
  "ar",
  "and",
  "bez",
  "dz",
  "dzeriens",
  "drink",
  "drinks",
  "g",
  "gazets",
  "italian",
  "l",
  "ml",
  "product",
  "sparkling",
  "sugar",
  "sugars",
  "the",
  "un",
  "with"
]);

const synonymMap: Record<string, string[]> = {
  pesca: ["peach", "persiku"],
  peach: ["pesca", "persiku"],
  clementina: ["clementine", "klementinu"],
  clementine: ["clementina", "klementinu"],
  limone: ["lemon", "citronu"],
  lemon: ["limone", "citronu"]
};

export function normalizeRetailText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return [
    ...new Set(
      normalizeRetailText(value)
        .split(" ")
        .filter((token) => token.length >= 2 && !stopWords.has(token))
    )
  ];
}

function tokenWeight(token: string): number {
  if (/^\d+$/.test(token)) return 0.8;
  if (token.length >= 9) return 4;
  if (token.length >= 6) return 3;
  if (token.length >= 4) return 2;
  return 1;
}

function scoreText(query: string, candidate: string, brand = ""): number {
  const queryTokens = tokens(query);
  const candidateTokens = new Set(tokens(candidate));
  if (!queryTokens.length) return 0;
  const total = queryTokens.reduce((sum, token) => sum + tokenWeight(token), 0);
  const matched = queryTokens.reduce(
    (sum, token) =>
      sum +
      ([token, ...(synonymMap[token] || [])].some((alternative) => candidateTokens.has(alternative)) ||
      [...candidateTokens].some((candidateToken) =>
        token.length >= 5 && candidateToken.length >= 5
          ? candidateToken.startsWith(token) || token.startsWith(candidateToken)
          : false
      )
        ? tokenWeight(token)
        : 0),
    0
  );
  const compactBrand = normalizeRetailText(brand).replaceAll(" ", "");
  const compactCandidate = normalizeRetailText(candidate).replaceAll(" ", "");
  const brandBonus = compactBrand.length >= 4 && compactCandidate.includes(compactBrand) ? 0.22 : 0;
  return Math.min(1, matched / total + brandBonus);
}

function lookupQuery(input: BarboraLookupInput): string {
  return [input.brand, input.name, input.variant, input.packSize, ...input.searchTerms].filter(Boolean).join(" ");
}

export function rankBarboraCandidates(
  input: BarboraLookupInput,
  slugs: string[] = productSlugs as string[],
  limit = 4
): RankedBarboraCandidate[] {
  const query = lookupQuery(input);
  return slugs
    .map((slug) => ({ slug, score: scoreText(query, slug.replaceAll("-", " "), input.brand) }))
    .filter((candidate) => candidate.score >= 0.28)
    .sort((left, right) => right.score - left.score || left.slug.localeCompare(right.slug))
    .slice(0, limit);
}

interface BarboraPageProduct {
  title: string;
  brand_name: string;
  price: number;
  comparative_unit?: string;
  comparative_unit_price?: number;
  image?: string;
  Url: string;
  status?: string;
}

export function parseBarboraProductPage(html: string): BarboraPageProduct {
  const match = html.match(/window\.product = (\{.*?\});/s);
  if (!match) throw new Error("Barbora product payload was not found");
  const product = JSON.parse(match[1]) as BarboraPageProduct;
  if (!product.title || !product.brand_name || !Number.isFinite(product.price) || !product.Url) {
    throw new Error("Barbora product payload is incomplete");
  }
  return product;
}

const productPageCache = new Map<string, { expiresAt: number; product: BarboraPageProduct }>();

async function fetchOffer(slug: string, input: BarboraLookupInput, indexScore: number): Promise<RetailerOffer | null> {
  const url = `https://barbora.lv/produkti/${slug}`;
  const cached = productPageCache.get(slug);
  let product = cached && cached.expiresAt > Date.now() ? cached.product : null;
  if (!product) {
    const response = await fetch(url, {
      headers: { "user-agent": "Sugar.no Latvia catalog research demo/0.1" },
      signal: AbortSignal.timeout(5_000)
    });
    if (!response.ok) return null;
    product = parseBarboraProductPage(await response.text());
    productPageCache.set(slug, { product, expiresAt: Date.now() + 5 * 60_000 });
  }
  if (product.status && product.status !== "active") return null;
  const pageScore = scoreText(lookupQuery(input), `${product.brand_name} ${product.title} ${product.Url}`, input.brand);
  const matchConfidence = Math.min(1, indexScore * 0.35 + pageScore * 0.65);
  return {
    retailer: "Barbora",
    slug: product.Url,
    title: product.title,
    brand: product.brand_name,
    url,
    price: product.price,
    currency: "EUR",
    unitPrice: Number.isFinite(product.comparative_unit_price) ? product.comparative_unit_price! : null,
    unit: product.comparative_unit || null,
    imageUrl: product.image || null,
    checkedAt: new Date().toISOString(),
    matchConfidence,
    exactSku: false
  };
}

export function isExactBarboraMatch(bestConfidence: number, runnerUpConfidence: number): boolean {
  return bestConfidence >= 0.72 && bestConfidence - runnerUpConfidence >= 0.08;
}

export async function getBarboraOfferBySlug(slug: string, input: BarboraLookupInput): Promise<RetailerOffer | null> {
  const offer = await fetchOffer(slug, input, 1);
  return offer ? { ...offer, exactSku: true } : null;
}

export async function resolveBarboraOffer(input: BarboraLookupInput): Promise<RetailerOffer | null> {
  const candidates = rankBarboraCandidates(input, productSlugs as string[], 3);
  const offers = (await Promise.all(candidates.map((candidate) => fetchOffer(candidate.slug, input, candidate.score)))).filter(
    (offer): offer is RetailerOffer => Boolean(offer)
  );
  const ranked = offers.sort((left, right) => right.matchConfidence - left.matchConfidence);
  const best = ranked[0];
  if (!best || best.matchConfidence < 0.45) return null;
  return {
    ...best,
    exactSku: isExactBarboraMatch(best.matchConfidence, ranked[1]?.matchConfidence || 0)
  };
}
