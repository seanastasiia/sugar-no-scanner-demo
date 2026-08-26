import productSlugs from "../../data/barbora-product-index.generated.json";
import { investorCategoryForRetailPath, type InvestorCategory } from "@/lib/supported-categories";
import type { RetailerOffer } from "@/lib/types";
import {
  getIndexedBarboraNutrition,
  listIndexedBarboraNutrition,
  type BarboraNutritionIndexProduct
} from "./barbora-nutrition-index";

export interface BarboraLookupInput {
  brand: string;
  name: string;
  variant: string;
  packSize: string;
  searchTerms: string[];
  categoryHint?: InvestorCategory | null;
}

interface RankedBarboraCandidate {
  slug: string;
  score: number;
}

export interface VisualBarboraCandidate extends RankedBarboraCandidate {
  title: string;
  brand: string;
  packSize: string;
  imageUrl: string | null;
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
  "klasika",
  "klasiska",
  "klasiskais",
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
  tuna: ["tonno", "tunzivs"],
  tonno: ["tuna", "tunzivs"],
  tunzivs: ["tuna", "tonno"],
  brine: ["sava", "sula"],
  olive: ["oliva", "olivella"],
  oliva: ["olive", "olivella"],
  olivella: ["olive", "oliva"],
  chocolate: ["sokolades"],
  sokolades: ["chocolate"],
  banana: ["bananu"],
  bananu: ["banana"],
  mayonnaise: ["majoneze", "mayo"],
  majoneze: ["mayonnaise", "mayo"],
  mayo: ["mayonnaise", "majoneze"],
  garlic: ["kiploku"],
  kiploku: ["garlic"],
  cheese: ["siera", "siers"],
  siera: ["cheese", "siers"],
  cookie: ["cepumi", "biscuit"],
  cookies: ["cepumi", "biscuits"],
  biscuit: ["cepumi", "cookie"],
  biscuits: ["cepumi", "cookies"],
  cepumi: ["cookie", "cookies", "biscuit", "biscuits"],
  yogurt: ["jogurts", "yoghurt"],
  yoghurt: ["jogurts", "yogurt"],
  jogurts: ["yogurt", "yoghurt"],
  milk: ["piens"],
  piens: ["milk"],
  curd: ["biezpiena", "biezpiens"],
  biezpiena: ["curd", "biezpiens"],
  biezpiens: ["curd", "biezpiena"],
  dessert: ["deserts"],
  deserts: ["dessert"],
  pudding: ["pudins"],
  pudins: ["pudding"],
  classic: ["klasiska", "klasiskais"],
  klasiska: ["classic", "klasiskais"],
  original: ["originala", "originalais"],
  originala: ["original", "originalais"],
  pesca: ["peach", "persiku"],
  peach: ["pesca", "persiku"],
  persiku: ["peach", "pesca"],
  strawberry: ["zemenu"],
  zemenu: ["strawberry"],
  raspberry: ["avenu"],
  avenu: ["raspberry"],
  blueberry: ["mellenu"],
  mellenu: ["blueberry"],
  cherry: ["kirsu"],
  kirsu: ["cherry"],
  vanilla: ["vanilas"],
  vanilas: ["vanilla"],
  caramel: ["karamelu"],
  karamelu: ["caramel"],
  coconut: ["kokosriekstu"],
  kokosriekstu: ["coconut"],
  condensed: ["iebiezinata", "kondenseta"],
  iebiezinata: ["condensed", "kondenseta"],
  kondenseta: ["condensed", "iebiezinata"],
  clementina: ["clementine", "klementinu"],
  clementine: ["clementina", "klementinu"],
  limone: ["lemon", "citronu"],
  lemon: ["limone", "citronu"]
};

const flavorTokens = new Set([
  "avenu",
  "bananu",
  "caramel",
  "cherry",
  "chocolate",
  "citronu",
  "coconut",
  "karamelu",
  "kirsu",
  "kokosriekstu",
  "lemon",
  "mellenu",
  "persiku",
  "raspberry",
  "sokolades",
  "strawberry",
  "vanilas",
  "zemenu"
]);

const productLineTokens = new Set(["cirks", "gimenei", "mini", "nature", "treat"]);

export function normalizeRetailText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function retailerBrandMatches(observedBrand: string, retailerBrand: string): boolean {
  const observed = normalizeRetailText(observedBrand).replaceAll(" ", "");
  const retailer = normalizeRetailText(retailerBrand).replaceAll(" ", "");
  if (observed.length < 3 || retailer.length < 3) return true;
  return observed.includes(retailer) || retailer.includes(observed);
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

function tokenMatches(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length >= 5 && right.length >= 5 && (left.startsWith(right) || right.startsWith(left))) return true;
  const shorter = Math.min(left.length, right.length);
  if (shorter < 5) return false;
  let prefix = 0;
  while (prefix < shorter && left[prefix] === right[prefix]) prefix += 1;
  return prefix >= shorter - 1;
}

function scoreText(query: string, candidate: string, brand = ""): number {
  const queryTokens = tokens(query);
  const candidateTokens = new Set(tokens(candidate));
  if (!queryTokens.length) return 0;
  const total = queryTokens.reduce((sum, token) => sum + tokenWeight(token), 0);
  const matched = queryTokens.reduce(
    (sum, token) =>
      sum +
      ([token, ...(synonymMap[token] || [])].some((alternative) =>
        [...candidateTokens].some((candidateToken) => tokenMatches(alternative, candidateToken))
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

interface CanonicalQuantity {
  amount: number;
  dimension: "solid" | "liquid";
  count: number;
}

function canonicalQuantity(value: string): CanonicalQuantity | null {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll("×", "x")
    .replaceAll(",", ".")
    .replace(/[^a-z0-9.+]+/g, " ")
    .trim();
  const multi = normalized.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l)\b/);
  const promotion = normalized.match(/\b(\d+)\s*\+\s*(\d+)\b/);
  const match = multi || normalized.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l)\b/);
  if (!match) return null;
  const count = multi
    ? Number.parseInt(match[1], 10)
    : promotion
      ? Number.parseInt(promotion[1], 10) + Number.parseInt(promotion[2], 10)
      : 1;
  const numeric = Number.parseFloat(match[multi ? 2 : 1]);
  const unit = match[multi ? 3 : 2];
  const factor = unit === "kg" || unit === "l" ? 1_000 : unit === "cl" ? 10 : 1;
  return {
    amount: (multi ? count * numeric : numeric) * factor,
    dimension: unit === "ml" || unit === "cl" || unit === "l" ? "liquid" : "solid",
    count
  };
}

function expandedTokens(value: string): string[] {
  return [
    ...new Set(
      tokens(value).flatMap((token) => [token, ...(synonymMap[token] || [])])
    )
  ];
}

function weightedCoverage(query: string[], candidate: Set<string>, frequencies: Map<string, number>, size: number): number {
  if (!query.length) return 0;
  let matched = 0;
  let total = 0;
  for (const token of query) {
    const frequency = frequencies.get(token) || 0;
    const weight = Math.max(1, Math.log((size + 1) / (frequency + 1)) + 1);
    total += weight;
    if (
      [...candidate].some((candidateToken) => tokenMatches(token, candidateToken))
    ) {
      matched += weight;
    }
  }
  return total ? matched / total : 0;
}

interface PreparedBarboraIndex {
  candidateTokens: string[][];
  frequencies: Map<string, number>;
}

const preparedIndexes = new WeakMap<BarboraNutritionIndexProduct[], PreparedBarboraIndex>();

function prepareBarboraIndex(products: BarboraNutritionIndexProduct[]): PreparedBarboraIndex {
  const cached = preparedIndexes.get(products);
  if (cached) return cached;
  const candidateTokens = products.map((product) => {
    const candidateBrandTokens = new Set(expandedTokens(product.brand));
    return expandedTokens(`${product.title} ${product.slug.replaceAll("-", " ")}`)
      .filter((token) => !candidateBrandTokens.has(token) && !/^\d+$/.test(token));
  });
  const frequencies = new Map<string, number>();
  candidateTokens.forEach((candidate) => {
    new Set(candidate).forEach((token) => frequencies.set(token, (frequencies.get(token) || 0) + 1));
  });
  const prepared = { candidateTokens, frequencies };
  preparedIndexes.set(products, prepared);
  return prepared;
}

export function rankIndexedBarboraCandidates(
  input: BarboraLookupInput,
  products: BarboraNutritionIndexProduct[] = listIndexedBarboraNutrition(),
  limit = 5
): RankedBarboraCandidate[] {
  const observedBrand = normalizeRetailText(input.brand);
  if (observedBrand.replaceAll(" ", "").length < 3) return [];
  const brandTokens = new Set(expandedTokens(input.brand));
  const rawQueryTokens = expandedTokens([input.name, input.variant, ...input.searchTerms].filter(Boolean).join(" "))
    .filter((token) => !brandTokens.has(token) && !/^\d+$/.test(token));
  const classicQuery = rawQueryTokens.some((token) => ["classic", "klasiska", "klasiskais"].includes(token));
  const queryContainsFlavor = rawQueryTokens.some((token) => flavorTokens.has(token));
  const queryTokens = queryContainsFlavor
    ? rawQueryTokens.filter((token) => !["classic", "klasiska", "klasiskais"].includes(token))
    : rawQueryTokens;
  const observedQuantity = canonicalQuantity([input.packSize, input.name].filter(Boolean).join(" "));
  const scopedProducts = input.categoryHint
    ? products.filter((product) => investorCategoryForRetailPath(product.category) === input.categoryHint)
    : products;
  const rankingProducts = scopedProducts.length ? scopedProducts : products;
  const { candidateTokens, frequencies } = prepareBarboraIndex(rankingProducts);

  const ranked = rankingProducts
    .flatMap((product, index): RankedBarboraCandidate[] => {
      const observedBrandTokens = tokens(input.brand);
      const titleTokens = tokens(product.title);
      const titleContainsObservedBrand =
        observedBrandTokens.length > 0 &&
        observedBrandTokens.every((token) => titleTokens.some((candidateToken) => tokenMatches(token, candidateToken)));
      if (!retailerBrandMatches(input.brand, product.brand) && !titleContainsObservedBrand) return [];
      const candidateQuantity = canonicalQuantity(`${product.packSize} ${product.title}`);
      if (observedQuantity && candidateQuantity) {
        if (observedQuantity.dimension !== candidateQuantity.dimension) return [];
        if ((observedQuantity.count > 1) !== (candidateQuantity.count > 1)) return [];
        const difference = Math.abs(observedQuantity.amount - candidateQuantity.amount) /
          Math.max(observedQuantity.amount, candidateQuantity.amount);
        if (difference > 0.06) return [];
      }
      const candidate = new Set(candidateTokens[index]);
      const nameCoverage = weightedCoverage(queryTokens, candidate, frequencies, rankingProducts.length);
      const reverseTokens = [...candidate].filter(
        (token) => (frequencies.get(token) || 0) < rankingProducts.length * 0.08
      );
      const reverseCoverage = weightedCoverage(reverseTokens, new Set(queryTokens), frequencies, rankingProducts.length);
      const packBonus = observedQuantity && candidateQuantity ? 0.08 : 0;
      const classicBonus = classicQuery && !queryContainsFlavor &&
        ![...candidate].some((token) => flavorTokens.has(token))
        ? 0.14
        : 0;
      const lineConflictPenalty = classicQuery && [...candidate].some((token) => productLineTokens.has(token))
        ? 0.18
        : 0;
      const score = Math.min(
        1,
        0.24 + nameCoverage * 0.58 + reverseCoverage * 0.1 + packBonus + classicBonus - lineConflictPenalty
      );
      return score >= 0.52 ? [{ slug: product.slug, score }] : [];
    })
    .sort((left, right) => right.score - left.score || left.slug.localeCompare(right.slug))
    .slice(0, limit);
  return ranked.length || !input.categoryHint
    ? ranked
    : rankIndexedBarboraCandidates({ ...input, categoryHint: null }, products, limit);
}

export function visualBarboraCandidates(input: BarboraLookupInput, limit = 3): VisualBarboraCandidate[] {
  const indexed = listIndexedBarboraNutrition();
  return rankIndexedBarboraCandidates(input, indexed, limit).flatMap((candidate): VisualBarboraCandidate[] => {
    const product = getIndexedBarboraNutrition(candidate.slug);
    return product
      ? [{
          ...candidate,
          title: product.title,
          brand: product.brand,
          packSize: product.packSize,
          imageUrl: product.imageUrl
        }]
      : [];
  });
}

export function resolveIndexedBarboraCandidate(input: BarboraLookupInput): RankedBarboraCandidate | null {
  const candidates = rankIndexedBarboraCandidates(input, listIndexedBarboraNutrition(), 2);
  const best = candidates[0];
  if (!best || !isExactBarboraMatch(best.score, candidates[1]?.score || 0)) return null;
  return best;
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

export interface BarboraNutrientAmount {
  Amount: number;
  UnitName: string;
}

export interface BarboraNutrient {
  Name: string;
  Amounts: BarboraNutrientAmount[];
}

export interface BarboraProductAttribute {
  id: string;
  value: string;
  group: number;
}

export interface BarboraPageProduct {
  title: string;
  brand_name: string;
  price: number;
  comparative_unit?: string;
  comparative_unit_price?: number;
  image?: string;
  Url: string;
  status?: string;
  nutrients?: BarboraNutrient[];
  attributes?: {
    list?: BarboraProductAttribute[];
    additional?: Record<string, boolean>;
  };
  description?: string;
  ingredients?: string;
  category_name_full_path?: string;
  root_category_id?: string;
  is_adult?: boolean;
}

export function parseBarboraProductPage(html: string): BarboraPageProduct {
  const match = html.match(/window\.product = (\{.*?\});/s);
  if (!match) throw new Error("Barbora product payload was not found");
  const product = JSON.parse(match[1]) as BarboraPageProduct;
  if (!product.title || !Number.isFinite(product.price) || !product.Url) {
    throw new Error("Barbora product payload is incomplete");
  }
  return product;
}

const productPageCache = new Map<string, { expiresAt: number; product: BarboraPageProduct }>();
const knownProductSlugs = new Set([
  ...(productSlugs as string[]),
  ...listIndexedBarboraNutrition().map((product) => product.slug)
]);

export async function getBarboraProductBySlug(slug: string): Promise<BarboraPageProduct | null> {
  if (!knownProductSlugs.has(slug)) return null;
  const cached = productPageCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) return cached.product;

  const response = await fetch(`https://barbora.lv/produkti/${slug}`, {
    headers: { "user-agent": "Sugar.no Latvia catalog research demo/0.1" },
    signal: AbortSignal.timeout(5_000)
  });
  if (!response.ok) return null;
  const product = parseBarboraProductPage(await response.text());
  if (product.status && product.status !== "active") return null;
  productPageCache.set(slug, { product, expiresAt: Date.now() + 5 * 60_000 });
  return product;
}

export async function getKnownBarboraOfferBySlug(slug: string): Promise<RetailerOffer | null> {
  const product = await getBarboraProductBySlug(slug);
  if (!product || product.Url !== slug) return null;
  return {
    retailer: "Barbora",
    slug: product.Url,
    title: product.title,
    brand: product.brand_name,
    url: `https://barbora.lv/produkti/${product.Url}`,
    price: product.price,
    currency: "EUR",
    unitPrice: Number.isFinite(product.comparative_unit_price) ? product.comparative_unit_price! : null,
    unit: product.comparative_unit || null,
    imageUrl: product.image || null,
    checkedAt: new Date().toISOString(),
    matchConfidence: 1,
    exactSku: true
  };
}

async function fetchOffer(slug: string, input: BarboraLookupInput, indexScore: number): Promise<RetailerOffer | null> {
  const url = `https://barbora.lv/produkti/${slug}`;
  const product = await getBarboraProductBySlug(slug);
  if (!product) return null;
  if (!retailerBrandMatches(input.brand, product.brand_name)) return null;
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
  const margin = bestConfidence - runnerUpConfidence;
  return (bestConfidence >= 0.72 && margin >= 0.08) || (bestConfidence >= 0.82 && margin >= 0.06);
}

export async function getBarboraOfferBySlug(slug: string, input: BarboraLookupInput): Promise<RetailerOffer | null> {
  const offer = await fetchOffer(slug, input, 1);
  return offer ? { ...offer, exactSku: true } : null;
}

export async function resolveBarboraOffer(input: BarboraLookupInput): Promise<RetailerOffer | null> {
  const best = resolveIndexedBarboraCandidate(input);
  if (!best) return null;
  // The local index already contains the full title, brand, pack and nutrition
  // evidence. Only an exact text match earns one live page read for current
  // price/availability; ambiguous candidates never trigger speculative network
  // fetches or retailer links.
  return getBarboraOfferBySlug(best.slug, input);
}
