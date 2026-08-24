import { GoogleGenAI, ThinkingLevel, createPartFromBase64, createPartFromText } from "@google/genai";
import { z } from "zod";
import { dedupeProductDetections } from "@/lib/product-detection-dedupe";
import type { ProductDetection, RecognitionResponse, ScanSource, ScoredProduct } from "@/lib/types";
import { getBarboraOfferBySlug, resolveBarboraOffer, type BarboraLookupInput } from "./barbora-catalog";

export const DEFAULT_GEMINI_MODEL = "gemini-3.7-flash";
const DEFAULT_RECOGNITION_THRESHOLD = 0.72;
const DEFAULT_FOCUSED_RECOGNITION_THRESHOLD = 0.58;

const providerResponseSchema = z.object({
  detections: z.array(
    z.object({
      brand: z.string().max(80),
      productName: z.string().max(180),
      searchQuery: z.string().max(240),
      confidence: z.number().min(0).max(1),
      box: z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        width: z.number().min(0).max(1),
        height: z.number().min(0).max(1)
      }),
      shelfPriceCents: z.number().int().min(0).max(1_000_000),
      shelfPriceText: z.string().max(60),
      shelfPriceConfidence: z.number().min(0).max(1),
      shelfPriceLabelVisible: z.boolean()
    })
  )
});

export type ProviderDetection = z.infer<typeof providerResponseSchema>["detections"][number];

const sampleShelf: ProductDetection[] = [
  {
    productId: "prot-bat-sal-riekst-saldin-barebells-55-g",
    confidence: 0.98,
    box: { x: 0.01, y: 0.27, width: 0.24, height: 0.28 },
    observedText: "Barebells Salty Peanut"
  },
  {
    productId: "prot-bat-barebells-lemon-cheesecake-55-g",
    confidence: 0.97,
    box: { x: 0.25, y: 0.27, width: 0.24, height: 0.28 },
    observedText: "Barebells Lemon Cheesecake"
  },
  {
    productId: "proteina-bat-cepuma-garsa-iconfit-55-g",
    confidence: 0.96,
    box: { x: 0.5, y: 0.27, width: 0.24, height: 0.28 },
    observedText: "ICONFIT Cookie Bliss"
  },
  {
    productId: "proteina-baton-barebells-coco-choco-55-g",
    confidence: 0.95,
    box: { x: 0.75, y: 0.27, width: 0.24, height: 0.28 },
    observedText: "Barebells Coco Choco"
  }
];

const sampleCheckout: ProductDetection[] = [
  {
    productId: "prot-bat-sal-riekst-saldin-barebells-55-g",
    confidence: 0.98,
    box: { x: 0.22, y: 0.36, width: 0.2, height: 0.18 },
    observedText: "Barebells Salty Peanut"
  },
  {
    productId: "prot-bat-barebells-lemon-cheesecake-55-g",
    confidence: 0.97,
    box: { x: 0.36, y: 0.38, width: 0.2, height: 0.18 },
    observedText: "Barebells Lemon Cheesecake"
  },
  {
    productId: "proteina-bat-cepuma-garsa-iconfit-55-g",
    confidence: 0.96,
    box: { x: 0.51, y: 0.4, width: 0.2, height: 0.18 },
    observedText: "ICONFIT Cookie Bliss"
  },
  {
    productId: "proteina-baton-barebells-coco-choco-55-g",
    confidence: 0.95,
    box: { x: 0.65, y: 0.42, width: 0.2, height: 0.18 },
    observedText: "Barebells Coco Choco"
  }
];

function sampleResponse(source: ScanSource): ProductDetection[] | null {
  if (source === "sample-shelf") return sampleShelf;
  if (source === "sample-conveyor") return sampleCheckout;
  return null;
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
  const hasExplicitCurrency = /€|\beur\b/i.test(detection.shelfPriceText);
  if (!observedAmount || !hasExplicitCurrency) return false;
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

export function matchCatalogProductWithConfidence(
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
  return value.match(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|cl|pcs?|gab)\b/i)?.[0] || "";
}

export function recognitionInstruction(focusMode: boolean): string {
  const scope = focusMode
    ? `This is a center crop after a broad scan was uncertain. Identify the most prominent readable package in the crop. ` +
      `Repeated copies of the same package are one SKU; return it once rather than returning an empty result. `
    : `Scan the complete frame from left to right and top to bottom. Identify every distinct clearly readable front-facing ` +
      `packaged retail SKU, including several different products on the same shelf, up to the response limit. ` +
      `Do not stop after the central or most prominent package. Include that package as a fallback, but also return readable ` +
      `products elsewhere in the frame. Repeated facings of the same SKU are one product type and must be returned once. `;

  return (
    scope +
    `Read the front label and return the exact visible brand plus one productName containing the product, variant or flavor and pack size. ` +
    `searchQuery should repeat the identity using useful English or Latvian equivalents of foreign flavor words for retailer matching. ` +
    `Only when a separate physical shelf price label outside the package is clearly visible and associated with that exact package, ` +
    `set shelfPriceLabelVisible true and return its EUR price in cents, the exact observed price text including € or EUR, and a separate confidence. ` +
    `Otherwise set shelfPriceLabelVisible false, price cents and confidence to zero, and price text to an empty string. ` +
    `Never treat nutrition claims, pack size, deposit text or any number printed on the package as a shelf price. ` +
    `Return an empty detections array rather than guessing when no product identity is readable. ` +
    `Return at most one box per distinct front-facing SKU and do not enumerate repeated or blurry background packages. ` +
    `Boxes use x, y, width and height normalized from 0 to 1.`
  );
}

export interface DetectionResolutionDependencies {
  getOfferBySlug: typeof getBarboraOfferBySlug;
  resolveOffer: typeof resolveBarboraOffer;
}

const defaultResolutionDependencies: DetectionResolutionDependencies = {
  getOfferBySlug: getBarboraOfferBySlug,
  resolveOffer: resolveBarboraOffer
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
 * Resolves all visible identities, including the seventh and eighth detections,
 * while bounding outbound Barbora lookups. The vision model supplies identity
 * only; nutrition is linked exclusively through a sufficiently confident
 * catalog or exact retailer match.
 */
export async function resolveVisibleDetections(
  visible: ProviderDetection[],
  catalog: ScoredProduct[],
  dependencies: DetectionResolutionDependencies = defaultResolutionDependencies,
  concurrency = 3
): Promise<ProductDetection[]> {
  const resolved = await mapWithConcurrency(visible, concurrency, async (detection): Promise<ProductDetection> => {
    const packSize = extractPackSize(detection.productName);
    const observedIdentity = {
      brand: detection.brand,
      name: detection.productName,
      variant: "",
      packSize,
      observedText: detection.productName
    };
    const initialCatalogMatch = matchCatalogProductWithConfidence(observedIdentity, catalog);
    const lookupInput: BarboraLookupInput = {
      brand: detection.brand,
      name: detection.productName,
      variant: "",
      packSize,
      searchTerms: [detection.searchQuery]
    };
    const retailerOffer = initialCatalogMatch
      ? await dependencies.getOfferBySlug(initialCatalogMatch.product.id, lookupInput).catch(() => null)
      : await dependencies.resolveOffer(lookupInput).catch(() => null);
    const exactRetailerOffer = retailerOffer?.exactSku ? retailerOffer : null;
    const knownProduct =
      initialCatalogMatch?.product ||
      (exactRetailerOffer ? catalog.find((product) => product.id === exactRetailerOffer.slug) || null : null);
    const nutritionLinkConfidence = initialCatalogMatch?.confidence ?? exactRetailerOffer?.matchConfidence ?? null;
    const productId =
      knownProduct?.id ||
      (exactRetailerOffer
        ? `barbora:${exactRetailerOffer.slug}`
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
        category: null,
        matchKind: knownProduct ? "verified_catalog" : exactRetailerOffer ? "barbora" : "visual_only"
      },
      shelfPrice: isTrustedShelfPriceDetection(detection)
        ? {
            amount: detection.shelfPriceCents / 100,
            currency: "EUR",
            observedText: detection.shelfPriceText,
            confidence: detection.shelfPriceConfidence
          }
        : null,
      retailerOffer,
      nutritionLinkConfidence
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
}): Promise<RecognitionResponse> {
  const startedAt = performance.now();
  const sample = sampleResponse(input.source);
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
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
  const response = await ai.models.generateContent({
    model,
    contents: [
      createPartFromText(
        recognitionInstruction(focusMode)
      ),
      createPartFromBase64(base64, mimeType)
    ],
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["detections"],
        properties: {
          detections: {
            type: "array",
            maxItems: 8,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "brand",
                "productName",
                "searchQuery",
                "confidence",
                "box",
                "shelfPriceCents",
                "shelfPriceText",
                "shelfPriceConfidence",
                "shelfPriceLabelVisible"
              ],
              properties: {
                brand: { type: "string", maxLength: 80 },
                productName: { type: "string", maxLength: 180 },
                searchQuery: { type: "string", maxLength: 240 },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                shelfPriceCents: { type: "integer", minimum: 0, maximum: 1000000 },
                shelfPriceText: { type: "string", maxLength: 60 },
                shelfPriceConfidence: { type: "number", minimum: 0, maximum: 1 },
                shelfPriceLabelVisible: { type: "boolean" },
                box: {
                  type: "object",
                  additionalProperties: false,
                  required: ["x", "y", "width", "height"],
                  properties: {
                    x: { type: "number", minimum: 0, maximum: 1 },
                    y: { type: "number", minimum: 0, maximum: 1 },
                    width: { type: "number", minimum: 0, maximum: 1 },
                    height: { type: "number", minimum: 0, maximum: 1 }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
  const parsed = providerResponseSchema.parse(JSON.parse(response.text || '{"detections":[]}'));
  const visible = parsed.detections
    .filter((detection) => detection.confidence >= threshold)
    .map((detection) => ({ ...detection, box: fitBoxToFrame(detection.box) }))
    .filter((detection) => detection.box.width >= 0.02 && detection.box.height >= 0.02)
    .slice(0, 8);
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
  const detections = await resolveVisibleDetections(visible, input.catalog);

  return {
    requestId: input.requestId,
    status: detections.length ? "matched" : "not_sure",
    detections,
    latencyMs: Math.round(performance.now() - startedAt),
    model,
    imageStored: false
  };
}
