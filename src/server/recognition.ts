import {
  GoogleGenAI,
  MediaResolution,
  ThinkingLevel,
  createPartFromBase64,
  createPartFromText
} from "@google/genai";
import { z } from "zod";
import { dedupeProductDetections } from "@/lib/product-detection-dedupe";
import { MAX_SCAN_PRODUCTS } from "@/lib/scan-limits";
import type { InvestorCategory } from "@/lib/supported-categories";
import type {
  ProductDetection,
  RecognitionResponse,
  ScanSource,
  ScoredProduct
} from "@/lib/types";
import {
  getBarboraOfferBySlug,
  isExactBarboraMatch,
  resolveIndexedBarboraCandidate,
  resolveBarboraOffer,
  visualBarboraCandidates,
  type BarboraLookupInput,
  type VisualBarboraCandidate
} from "./barbora-catalog";
import { getIndexedBarboraProductWithAlternatives } from "./barbora-nutrition-index";
import { resolveOpenFoodFactsProduct } from "./open-food-facts";
import { resolveExternalCatalogProduct } from "./external-catalog";
import { resolveWebNutritionProduct } from "./web-nutrition";
import { sampleResponse } from "./demo-scenes";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const DEFAULT_RECOGNITION_THRESHOLD = 0.72;
const DEFAULT_FOCUSED_RECOGNITION_THRESHOLD = 0.58;

export function recognitionModel(
  environment: Record<string, string | undefined> = process.env
): string {
  return environment.GEMINI_RECOGNITION_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function recognitionThinkingLevel(model: string): ThinkingLevel {
  return model.startsWith("gemini-3.7") ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL;
}

export function recognitionRequestTimeoutMs(
  environment: Record<string, string | undefined> = process.env
): number {
  const configured = Number.parseInt(environment.GEMINI_RECOGNITION_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(configured) && configured >= 1_000 && configured <= 60_000
    ? configured
    : 15_000;
}

const rawProviderResponseSchema = z.object({
  detections: z.array(
    z.object({
      brand: z.string().max(80),
      productName: z.string().max(180),
      searchQuery: z.string().max(240),
      retailCategory: z.enum(["snack", "dairy_dessert", "other"]),
      barcode: z.string().max(14),
      confidence: z.number().min(0).max(1),
      box2d: z.tuple([
        z.number().int().min(0).max(1000),
        z.number().int().min(0).max(1000),
        z.number().int().min(0).max(1000),
        z.number().int().min(0).max(1000)
      ]),
      shelfPriceCents: z.number().int().min(0).max(1_000_000),
      shelfPriceText: z.string().max(60),
      shelfPriceConfidence: z.number().min(0).max(1),
      shelfPriceLabelVisible: z.boolean()
    })
  )
});

type RawProviderDetection = z.infer<typeof rawProviderResponseSchema>["detections"][number];

export type ProviderDetection = Omit<RawProviderDetection, "box2d"> & { box: ProductDetection["box"] };

export function geminiBox2dToFrame([yMin, xMin, yMax, xMax]: RawProviderDetection["box2d"]): ProductDetection["box"] {
  return fitBoxToFrame({
    x: xMin / 1000,
    y: yMin / 1000,
    width: Math.max(0, xMax - xMin) / 1000,
    height: Math.max(0, yMax - yMin) / 1000
  });
}

const candidateConfirmationResponseSchema = z.object({
  choices: z.array(
    z.object({
      detectionIndex: z.number().int().min(0).max(MAX_SCAN_PRODUCTS - 1),
      candidateSlug: z.string().max(220),
      confidence: z.number().min(0).max(1),
      evidence: z.string().max(220)
    })
  ).max(4)
});

interface CandidateConfirmationSet {
  detectionIndex: number;
  candidates: VisualBarboraCandidate[];
}

interface CandidateConfirmationChoice {
  detectionIndex: number;
  candidateSlug: string;
  confidence: number;
  evidence: string;
}

export type ConfirmedProviderDetection = ProviderDetection & { confirmedBarboraSlug?: string };

export function needsVisualCandidateConfirmation(
  set: CandidateConfirmationSet,
  allowSingleCandidate = false
): boolean {
  const best = set.candidates[0];
  if (!best || best.score < (allowSingleCandidate ? 0.52 : 0.62)) return false;
  if (set.candidates.length === 1) return allowSingleCandidate;
  return !isExactBarboraMatch(best.score, set.candidates[1]?.score || 0);
}

function imageParts(imageDataUrl: string) {
  const match = imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("unsupported_image");
  return { mimeType: match[1], base64: match[2] };
}

export function fitBoxToFrame(box: ProductDetection["box"]): ProductDetection["box"] {
  const x = Math.min(1, Math.max(0, box.x));
  const y = Math.min(1, Math.max(0, box.y));
  return {
    x,
    y,
    width: Math.max(0, Math.min(box.width, 1 - x)),
    height: Math.max(0, Math.min(box.height, 1 - y))
  };
}

export function isTrustedShelfPriceDetection(detection: {
  shelfPriceCents: number;
  shelfPriceText: string;
  shelfPriceConfidence: number;
  shelfPriceLabelVisible: boolean;
}): boolean {
  if (
    !detection.shelfPriceLabelVisible ||
    detection.shelfPriceCents <= 0 ||
    detection.shelfPriceConfidence < 0.9
  ) {
    return false;
  }
  const observedAmount = detection.shelfPriceText.match(/\d{1,4}[.,]\d{2}/)?.[0];
  if (!observedAmount) return false;
  return Math.round(Number.parseFloat(observedAmount.replace(",", ".")) * 100) === detection.shelfPriceCents;
}

export function recognitionConfidenceThreshold(
  focusMode: boolean,
  environment: Record<string, string | undefined> = process.env
): number {
  const fallback = focusMode ? DEFAULT_FOCUSED_RECOGNITION_THRESHOLD : DEFAULT_RECOGNITION_THRESHOLD;
  const configured = Number.parseFloat(
    environment[focusMode ? "FOCUSED_RECOGNITION_CONFIDENCE_THRESHOLD" : "RECOGNITION_CONFIDENCE_THRESHOLD"] || ""
  );
  return Number.isFinite(configured) && configured >= 0 && configured <= 1 ? configured : fallback;
}

function normalizeIdentityText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function identityTokens(value: string): Set<string> {
  return new Set(normalizeIdentityText(value).split(" ").filter((token) => token.length >= 3));
}

export function matchCatalogProduct(
  observed: { brand: string; name: string; variant: string; packSize: string; observedText: string },
  catalog: ScoredProduct[]
): ScoredProduct | null {
  return matchCatalogProductWithConfidence(observed, catalog)?.product || null;
}

function matchCatalogProductWithConfidence(
  observed: { brand: string; name: string; variant: string; packSize: string; observedText: string },
  catalog: ScoredProduct[]
): { product: ScoredProduct; confidence: number } | null {
  const observedBrand = normalizeIdentityText(observed.brand).replaceAll(" ", "");
  const queryTokens = identityTokens(
    `${observed.brand} ${observed.name} ${observed.variant} ${observed.packSize} ${observed.observedText}`
  );
  if (!observedBrand || !queryTokens.size) return null;
  const ranked = catalog
    .map((product) => {
      const productBrand = normalizeIdentityText(product.brand).replaceAll(" ", "");
      if (!productBrand.includes(observedBrand) && !observedBrand.includes(productBrand)) return { product, score: 0 };
      const candidateTokens = identityTokens([product.name, product.shortName, ...product.aliases].join(" "));
      const matches = [...queryTokens].filter((token) => candidateTokens.has(token)).length;
      return { product, score: matches / queryTokens.size + 0.35 };
    })
    .sort((left, right) => right.score - left.score);
  return ranked[0] && ranked[0].score >= 0.9
    ? { product: ranked[0].product, confidence: Math.min(1, ranked[0].score) }
    : null;
}

function genericProductId(brand: string, name: string, variant: string): string {
  const slug = normalizeIdentityText(`${brand} ${name} ${variant}`).replaceAll(" ", "-").slice(0, 90);
  return `visual:${slug || "recognized-product"}`;
}

function extractPackSize(value: string): string {
  return (
    value.match(/\b\d+\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|cl|pcs?|gab)\b/i)?.[0] ||
    value.match(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|cl|pcs?|gab)\b/i)?.[0] ||
    ""
  );
}

type RecognitionScene = "live-camera" | "saved-image";

export function recognitionInstruction(
  focusMode: boolean,
  scene: RecognitionScene = "live-camera"
): string {
  const scope = focusMode
    ? `This is a center crop after a broad scan was uncertain. Identify the most prominent readable package in the crop. ` +
      `Repeated copies of the same package are one SKU; return it once rather than returning an empty result. `
    : `Scan the complete frame from left to right and top to bottom. Identify up to ${MAX_SCAN_PRODUCTS} of the most confidently readable distinct front-facing ` +
      `packaged retail SKUs, including several different products on the same shelf. ` +
      `Do not stop after the central or most prominent package. Include that package as a fallback, but also return readable ` +
      `products elsewhere in the frame. Repeated facings of the same SKU are one product type and must be returned once. `;
  const savedImageContext =
    scene === "saved-image"
      ? `This saved image may be a supermarket shelf, a checkout photo, a long screenshot, or an online grocery or catalog page. ` +
        `On an online-store page, treat every visible product card as a candidate SKU. Read each product image together with its ` +
        `adjacent title, brand, variant and pack size, and return one detection for every distinct readable product card. ` +
        `Merge repeated copies of the same card or SKU rather than counting them twice. A price shown on an online-store page is not ` +
        `a physical shelf price label and must never be returned as shelfPrice. `
      : "";

  return (
    scope +
    savedImageContext +
    `Read the front label and preserve every clearly visible distinguishing word in productName: exact brand, product type, variant or flavor, ` +
    `and exact pack size or multipack count. Do not omit a readable size and do not guess one that is not visible. ` +
    `Classify retailCategory as snack for packaged sweet or salty snacks, dairy_dessert for yogurts, puddings, sweet curd creams or glazed curd snacks, ` +
    `and other for everything else. ` +
    `searchQuery should repeat the identity using useful English or Latvian equivalents of foreign flavor words for retailer matching. ` +
    `If a complete EAN-8, EAN-13 or UPC barcode number is clearly readable, return only its digits in barcode; otherwise return an empty string. ` +
    `Only when a separate physical shelf price label outside the package is clearly visible and associated with that exact package, ` +
    `set shelfPriceLabelVisible true and return its EUR price in cents, the exact observed price digits plus any visible currency, and a separate confidence. ` +
    `A Latvian shelf label may omit the € symbol; a clear comma-decimal amount such as 0,99 is still valid when it is visibly printed on a separate shelf label. ` +
    `The label must be on the immediate shelf edge for that package and horizontally aligned with it. Do not use distant header or promotion labels; ` +
    `when two labels could plausibly belong to the package, mark the shelf price as not visible instead of guessing. ` +
    `Otherwise set shelfPriceLabelVisible false, price cents and confidence to zero, and price text to an empty string. ` +
    `Never treat nutrition claims, pack size, deposit text or any number printed on the package as a shelf price. ` +
    `Return an empty detections array rather than guessing when no product identity is readable. ` +
    `Return no more than ${MAX_SCAN_PRODUCTS} boxes, at most one per distinct front-facing SKU, and do not enumerate repeated or blurry background packages. ` +
    `For every product, box2d must tightly enclose only that product package, excluding shelf labels, display trays, neighboring facings and empty space. ` +
    `Use the Gemini object-detection convention box2d [ymin, xmin, ymax, xmax] as integers normalized from 0 to 1000.`
  );
}

function lookupInputForDetection(detection: ProviderDetection): BarboraLookupInput {
  const packSize = extractPackSize(detection.productName);
  const categoryHint: InvestorCategory | null =
    detection.retailCategory === "snack"
      ? "snacks"
      : detection.retailCategory === "dairy_dessert"
        ? "dairy_desserts"
        : null;
  return {
    brand: detection.brand,
    name: detection.productName,
    variant: "",
    packSize,
    searchTerms: [detection.searchQuery],
    categoryHint
  };
}

export function applyBarboraCandidateConfirmations(
  detections: ProviderDetection[],
  sets: CandidateConfirmationSet[],
  choices: CandidateConfirmationChoice[]
): ConfirmedProviderDetection[] {
  const allowed = new Map(
    sets.map((set) => [set.detectionIndex, new Set(set.candidates.map((candidate) => candidate.slug))])
  );
  const accepted = new Map<number, CandidateConfirmationChoice>();
  for (const choice of choices) {
    if (
      choice.confidence < 0.92 ||
      !choice.candidateSlug ||
      !allowed.get(choice.detectionIndex)?.has(choice.candidateSlug)
    ) {
      continue;
    }
    const previous = accepted.get(choice.detectionIndex);
    if (!previous || choice.confidence > previous.confidence) accepted.set(choice.detectionIndex, choice);
  }
  return detections.map((detection, index) => {
    const choice = accepted.get(index);
    return choice ? { ...detection, confirmedBarboraSlug: choice.candidateSlug } : detection;
  });
}

async function fetchCandidateImage(
  candidate: VisualBarboraCandidate
): Promise<{ candidate: VisualBarboraCandidate; base64: string; mimeType: string } | null> {
  if (!candidate.imageUrl || !isTrustedCandidateImageUrl(candidate.imageUrl)) return null;
  try {
    const response = await fetch(candidate.imageUrl, {
      signal: AbortSignal.timeout(2_500),
      redirect: "error"
    });
    const mimeType = response.headers.get("content-type")?.split(";")[0] || "";
    if (!response.ok || !/^image\/(?:jpeg|png|webp)$/.test(mimeType)) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 750_000) return null;
    return { candidate, base64: bytes.toString("base64"), mimeType };
  } catch {
    return null;
  }
}

export function isTrustedCandidateImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "cdn.barbora.lv";
  } catch {
    return false;
  }
}

async function confirmAmbiguousBarboraCandidates(input: {
  ai: GoogleGenAI;
  model: string;
  mimeType: string;
  base64: string;
  detections: ProviderDetection[];
  allowSingleCandidate?: boolean;
}): Promise<ConfirmedProviderDetection[]> {
  const sets = input.detections
    .map((detection, detectionIndex): CandidateConfirmationSet => ({
      detectionIndex,
      candidates: visualBarboraCandidates(lookupInputForDetection(detection), 3)
    }))
    .filter((set) => needsVisualCandidateConfirmation(set, Boolean(input.allowSingleCandidate)))
    .sort((left, right) => (right.candidates[0]?.score || 0) - (left.candidates[0]?.score || 0))
    .slice(0, 4);
  if (!sets.length) return input.detections;

  const packshots = (
    await Promise.all(sets.flatMap((set) => set.candidates.slice(0, 2).map(fetchCandidateImage)))
  ).filter((image): image is NonNullable<typeof image> => Boolean(image));
  const lines = sets.flatMap((set) => {
    const detection = input.detections[set.detectionIndex];
    return [
      `Detection ${set.detectionIndex}: observed "${detection.brand} ${detection.productName}"; ` +
        `coarse category ${detection.retailCategory}; ` +
        `box x=${detection.box.x.toFixed(3)}, y=${detection.box.y.toFixed(3)}, ` +
        `w=${detection.box.width.toFixed(3)}, h=${detection.box.height.toFixed(3)}.`,
      ...set.candidates.map(
        (candidate) =>
          `- ${candidate.slug}: ${candidate.brand} ${candidate.title}; pack ${candidate.packSize || "not listed"}.`
      )
    ];
  });
  const parts = [
    createPartFromText(
      `The first image is the original supermarket frame. The text lists ambiguous exact Barbora SKU candidates for some already detected packages. ` +
        `Use the stated normalized box to inspect only that package, then compare its visible variant, container format, design and pack size with the candidate packshots that follow. ` +
        `Choose a candidate only when the exact SKU is visually supported. If the size/variant cannot be distinguished, return an empty candidateSlug and low confidence. ` +
        `Never choose merely because the brand and generic product type match. Return at most one choice per listed detection.\n${lines.join("\n")}`
    ),
    createPartFromBase64(input.base64, input.mimeType),
    ...packshots.flatMap((packshot) => [
      createPartFromText(`Candidate packshot ${packshot.candidate.slug}`),
      createPartFromBase64(packshot.base64, packshot.mimeType)
    ])
  ];

  try {
    const response = await input.ai.models.generateContent({
      model: input.model,
      contents: parts,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          additionalProperties: false,
          required: ["choices"],
          properties: {
            choices: {
              type: "array",
              maxItems: 4,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["detectionIndex", "candidateSlug", "confidence", "evidence"],
                properties: {
                  detectionIndex: { type: "integer", minimum: 0, maximum: 7 },
                  candidateSlug: { type: "string", maxLength: 220 },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  evidence: { type: "string", maxLength: 220 }
                }
              }
            }
          }
        }
      }
    });
    const parsed = candidateConfirmationResponseSchema.parse(JSON.parse(response.text || '{"choices":[]}'));
    return applyBarboraCandidateConfirmations(input.detections, sets, parsed.choices);
  } catch {
    return input.detections;
  }
}

export interface DetectionResolutionDependencies {
  getOfferBySlug: typeof getBarboraOfferBySlug;
  resolveOffer: typeof resolveBarboraOffer;
  resolveOpenFoodFacts: typeof resolveOpenFoodFactsProduct;
  resolveExternalCatalog?: typeof resolveExternalCatalogProduct;
  resolveIndexedCandidate?: typeof resolveIndexedBarboraCandidate;
  getIndexedProduct?: typeof getIndexedBarboraProductWithAlternatives;
  resolveWebNutrition?: typeof resolveWebNutritionProduct;
}

type DetectionResolutionMode = "fast" | "complete";

const defaultResolutionDependencies: DetectionResolutionDependencies = {
  getOfferBySlug: getBarboraOfferBySlug,
  resolveOffer: resolveBarboraOffer,
  resolveOpenFoodFacts: resolveOpenFoodFactsProduct,
  resolveExternalCatalog: resolveExternalCatalogProduct,
  resolveIndexedCandidate: resolveIndexedBarboraCandidate,
  getIndexedProduct: getIndexedBarboraProductWithAlternatives,
  resolveWebNutrition: resolveWebNutritionProduct
};

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), values.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await mapper(values[index], index);
      }
    })
  );
  return results;
}

/**
 * Resolves at most ten visible identities while bounding outbound lookups.
 * The vision model supplies identity only; nutrition is linked through an exact
 * catalog/database result or a cited, high-confidence grounded web result.
 */
export async function resolveVisibleDetections(
  visible: ConfirmedProviderDetection[],
  catalog: ScoredProduct[],
  dependencies: DetectionResolutionDependencies = defaultResolutionDependencies,
  concurrency = 3,
  mode: DetectionResolutionMode = "complete"
): Promise<ProductDetection[]> {
  const resolved = await mapWithConcurrency(visible.slice(0, MAX_SCAN_PRODUCTS), concurrency, async (detection): Promise<ProductDetection> => {
    const packSize = extractPackSize(detection.productName);
    const observedIdentity = {
      brand: detection.brand,
      name: detection.productName,
      variant: "",
      packSize,
      observedText: detection.productName
    };
    const initialCatalogMatch = matchCatalogProductWithConfidence(observedIdentity, catalog);
    const lookupInput = lookupInputForDetection(detection);
    const indexedBarboraMatch = initialCatalogMatch
      ? null
      : detection.confirmedBarboraSlug
        ? { slug: detection.confirmedBarboraSlug, score: 1 }
        : (dependencies.resolveIndexedCandidate || resolveIndexedBarboraCandidate)(lookupInput);
    const indexedProduct = indexedBarboraMatch
      ? dependencies.getIndexedProduct?.(indexedBarboraMatch.slug)?.product || null
      : null;
    const retailerOffer = mode === "fast"
      ? null
      : initialCatalogMatch
        ? await dependencies.getOfferBySlug(initialCatalogMatch.product.id, lookupInput).catch(() => null)
        : indexedBarboraMatch
          ? await dependencies.getOfferBySlug(indexedBarboraMatch.slug, lookupInput).catch(() => null)
          : await dependencies.resolveOffer(lookupInput).catch(() => null);
    const exactRetailerOffer = retailerOffer?.exactSku ? retailerOffer : null;
    const exactOfferProduct = exactRetailerOffer
      ? dependencies.getIndexedProduct?.(exactRetailerOffer.slug)?.product || null
      : null;
    const knownProduct = initialCatalogMatch?.product || indexedProduct || exactOfferProduct || null;
    // A missing pack size (and no readable barcode) cannot support an exact-SKU
    // nutrition link. Do not spend several seconds searching the web for a
    // result that our strict verifier must reject anyway.
    const hasExactIdentityEvidence = Boolean(packSize || /^\d{8,14}$/.test(detection.barcode));
    // Open Food Facts is the first internet fallback. A visual Barbora slug is
    // not enough to skip it when that exact SKU has no local nutrition record.
    const externalCatalogCandidate = mode === "fast" || knownProduct
      ? null
      : dependencies.resolveExternalCatalog?.(lookupInput, detection.barcode) || null;
    const openFoodFactsCandidate = mode === "fast" || knownProduct || externalCatalogCandidate || !hasExactIdentityEvidence
      ? null
      : await dependencies.resolveOpenFoodFacts(lookupInput, detection.barcode).catch(() => null);
    const webNutrition = mode === "fast" || knownProduct || externalCatalogCandidate || openFoodFactsCandidate || !hasExactIdentityEvidence
      ? null
      : await dependencies.resolveWebNutrition?.(lookupInput, detection.confidence).catch(() => null) || null;
    const resolvedProduct = knownProduct || externalCatalogCandidate?.product || openFoodFactsCandidate?.product || webNutrition?.product || null;
    const resolvedRetailerOffer = exactRetailerOffer || externalCatalogCandidate?.offer || retailerOffer;
    const nutritionLinkConfidence =
      initialCatalogMatch?.confidence ??
      externalCatalogCandidate?.confidence ??
      openFoodFactsCandidate?.confidence ??
      webNutrition?.confidence ??
      indexedBarboraMatch?.score ??
      exactRetailerOffer?.matchConfidence ??
      null;
    const productId =
      resolvedProduct?.id ||
      (indexedBarboraMatch || exactRetailerOffer
        ? `barbora:${indexedBarboraMatch?.slug || exactRetailerOffer!.slug}`
          : genericProductId(detection.brand, detection.productName, ""));
    return {
      productId,
      catalogProductId: knownProduct?.id || null,
      confidence: detection.confidence,
      box: detection.box,
      observedText: detection.productName,
      identity: {
        brand: detection.brand,
        name: detection.productName,
        variant: null,
        packSize: packSize || null,
        category:
          detection.retailCategory === "snack"
            ? "Packaged snacks"
            : detection.retailCategory === "dairy_dessert"
              ? "Dairy desserts"
              : null,
        searchQuery: detection.searchQuery,
        barcode: detection.barcode || null,
        matchKind: initialCatalogMatch
          ? "verified_catalog"
          : indexedProduct || exactOfferProduct
            ? "barbora"
            : externalCatalogCandidate
              ? "retailer_catalog"
            : openFoodFactsCandidate
              ? "open_food_facts"
              : webNutrition
                ? "web_search"
                : indexedBarboraMatch || exactRetailerOffer
                  ? "barbora"
                  : "visual_only"
      },
      shelfPrice: isTrustedShelfPriceDetection(detection)
        ? {
            amount: detection.shelfPriceCents / 100,
            currency: "EUR",
            observedText: detection.shelfPriceText,
            confidence: detection.shelfPriceConfidence
          }
        : null,
      retailerOffer: resolvedRetailerOffer,
      nutritionLinkConfidence,
      inlineProduct: externalCatalogCandidate?.product || webNutrition?.product || null
    };
  });
  return dedupeProductDetections(resolved);
}

export async function recognizeProducts(input: {
  imageDataUrl?: string;
  source: ScanSource;
  focusMode?: boolean;
  sampleFrame?: number;
  catalog: ScoredProduct[];
  requestId: string;
  deferExternalResolution?: boolean;
}): Promise<RecognitionResponse> {
  const startedAt = performance.now();
  const sample = sampleResponse(input.source);
  // Keep visual extraction independent from the slower model used by grounded
  // web nutrition. Dense shelf recognition is latency-sensitive and bounded.
  const model = recognitionModel();
  if (sample) {
    return {
      requestId: input.requestId,
      status: "matched",
      detections: sample,
      latencyMs: Math.round(performance.now() - startedAt),
      model: "deterministic-sample-v1",
      imageStored: false
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !input.imageDataUrl) {
    return {
      requestId: input.requestId,
      status: "provider_unavailable",
      detections: [],
      latencyMs: Math.round(performance.now() - startedAt),
      model,
      imageStored: false
    };
  }

  const focusMode = input.source === "camera" && Boolean(input.focusMode);
  const threshold = recognitionConfidenceThreshold(focusMode);
  const { mimeType, base64 } = imageParts(input.imageDataUrl);
  const ai = new GoogleGenAI({ apiKey });
  const providerStartedAt = performance.now();
  const response = await ai.models.generateContent({
    model,
    contents: [
      createPartFromText(
        recognitionInstruction(focusMode, input.source === "upload" ? "saved-image" : "live-camera")
      ),
      createPartFromBase64(base64, mimeType)
    ],
    config: {
      // Shelf recognition is a bounded visual extraction task. Minimal thinking
      // returns the structured boxes much faster; exact nutrition matching and
      // retailer verification still happen in the separate grounded resolver.
      thinkingConfig: { thinkingLevel: recognitionThinkingLevel(model) },
      httpOptions: { timeout: recognitionRequestTimeoutMs() },
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["detections"],
        properties: {
          detections: {
            type: "array",
            maxItems: MAX_SCAN_PRODUCTS,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "brand",
                "productName",
                "searchQuery",
                "retailCategory",
                "barcode",
                "confidence",
                "box2d",
                "shelfPriceCents",
                "shelfPriceText",
                "shelfPriceConfidence",
                "shelfPriceLabelVisible"
              ],
              properties: {
                brand: { type: "string", maxLength: 80 },
                productName: { type: "string", maxLength: 180 },
                searchQuery: { type: "string", maxLength: 240 },
                retailCategory: { type: "string", enum: ["snack", "dairy_dessert", "other"] },
                barcode: { type: "string", maxLength: 14 },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                shelfPriceCents: { type: "integer", minimum: 0, maximum: 1000000 },
                shelfPriceText: { type: "string", maxLength: 60 },
                shelfPriceConfidence: { type: "number", minimum: 0, maximum: 1 },
                shelfPriceLabelVisible: { type: "boolean" },
                box2d: {
                  type: "array",
                  minItems: 4,
                  maxItems: 4,
                  items: { type: "integer", minimum: 0, maximum: 1000 }
                }
              }
            }
          }
        }
      }
    }
  });
  const rawParsed = rawProviderResponseSchema.parse(JSON.parse(response.text || '{"detections":[]}'));
  const parsed: { detections: ProviderDetection[] } = {
    detections: rawParsed.detections.map(({ box2d, ...detection }) => ({
      ...detection,
      box: geminiBox2dToFrame(box2d)
    }))
  };
  const providerMs = Math.round(performance.now() - providerStartedAt);
  const visible = parsed.detections
    .filter((detection) => detection.confidence >= threshold)
    .map((detection) => ({ ...detection, box: fitBoxToFrame(detection.box) }))
    .filter((detection) => detection.box.width >= 0.02 && detection.box.height >= 0.02)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, MAX_SCAN_PRODUCTS);
  if (!visible.length) {
    console.info(
      JSON.stringify({
        event: "recognition_not_sure",
        requestId: input.requestId,
        focusMode,
        rawDetectionCount: parsed.detections.length,
        maxConfidence: parsed.detections.length
          ? Math.max(...parsed.detections.map((detection) => detection.confidence))
          : null,
        threshold
      })
    );
  }
  const confirmedVisible = input.deferExternalResolution
    ? visible
    : await confirmAmbiguousBarboraCandidates({
        ai,
        model,
        mimeType,
        base64,
        detections: visible,
        allowSingleCandidate: input.source === "upload"
      });
  const detections = await resolveVisibleDetections(
    confirmedVisible,
    input.catalog,
    defaultResolutionDependencies,
    3,
    input.deferExternalResolution ? "fast" : "complete"
  );
  console.info(
    JSON.stringify({
      event: "recognition_timing",
      requestId: input.requestId,
      source: input.source,
      deferredExternalResolution: Boolean(input.deferExternalResolution),
      providerMs,
      totalMs: Math.round(performance.now() - startedAt),
      detectionCount: detections.length
    })
  );

  return {
    requestId: input.requestId,
    status: detections.length ? "matched" : "not_sure",
    detections,
    latencyMs: Math.round(performance.now() - startedAt),
    model,
    imageStored: false
  };
}
