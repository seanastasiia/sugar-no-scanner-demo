import { GoogleGenAI, ThinkingLevel, createPartFromBase64, createPartFromText } from "@google/genai";
import { z } from "zod";
import { dedupeProductDetections } from "@/lib/product-detection-dedupe";
import type { ProductDetection, RecognitionResponse, ScanSource, ScoredProduct } from "@/lib/types";
import { getBarboraOfferBySlug, resolveBarboraOffer, type BarboraLookupInput } from "./barbora-catalog";

export const DEFAULT_GEMINI_MODEL = "gemini-3.7-flash";

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
    box: { x: 0.01, y: 0.35, width: 0.24, height: 0.31 },
    observedText: "Barebells Salty Peanut"
  },
  {
    productId: "prot-bat-barebells-lemon-cheesecake-55-g",
    confidence: 0.97,
    box: { x: 0.25, y: 0.36, width: 0.24, height: 0.31 },
    observedText: "Barebells Lemon Cheesecake"
  },
  {
    productId: "proteina-bat-cepuma-garsa-iconfit-55-g",
    confidence: 0.96,
    box: { x: 0.5, y: 0.35, width: 0.24, height: 0.32 },
    observedText: "ICONFIT Cookie Bliss"
  },
  {
    productId: "proteina-baton-barebells-coco-choco-55-g",
    confidence: 0.95,
    box: { x: 0.75, y: 0.36, width: 0.24, height: 0.32 },
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
  return ranked[0] && ranked[0].score >= 0.9 ? ranked[0].product : null;
}

function genericProductId(brand: string, name: string, variant: string): string {
  const slug = normalizeIdentityText(`${brand} ${name} ${variant}`).replaceAll(" ", "-").slice(0, 90);
  return `visual:${slug || "recognized-product"}`;
}

function extractPackSize(value: string): string {
  return value.match(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|cl|pcs?|gab)\b/i)?.[0] || "";
}

export async function recognizeProducts(input: {
  imageDataUrl?: string;
  source: ScanSource;
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

  const threshold = Number.parseFloat(process.env.RECOGNITION_CONFIDENCE_THRESHOLD || "0.72");
  const { mimeType, base64 } = imageParts(input.imageDataUrl);
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: [
      createPartFromText(
        `Identify every clearly visible packaged retail product, even when it is not in a supplied catalog. ` +
          `Read the front label and return the exact visible brand plus one productName containing the product, variant or flavor and pack size. ` +
          `searchQuery should repeat the identity using useful English or Latvian equivalents of foreign flavor words for retailer matching. ` +
          `Only when a separate physical shelf price label outside the package is clearly visible and associated with that exact package, ` +
          `set shelfPriceLabelVisible true and return its EUR price in cents, the exact observed price text including € or EUR, and a separate confidence. ` +
          `Otherwise set shelfPriceLabelVisible false, price cents and confidence to zero, and price text to an empty string. ` +
          `Never treat nutrition claims, pack size, deposit text or any number printed on the package as a shelf price. ` +
          `Return an empty detections array rather than guessing when the product identity is unreadable. ` +
          `Return at most one box per distinct front-facing SKU and do not enumerate repeated or blurry background packages. ` +
          `Boxes use x, y, width and height normalized from 0 to 1.`
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
  const resolvedDetections = await Promise.all(
    visible.map(async (detection, detectionIndex): Promise<ProductDetection> => {
      const packSize = extractPackSize(detection.productName);
      const observedIdentity = {
        brand: detection.brand,
        name: detection.productName,
        variant: "",
        packSize,
        observedText: detection.productName
      };
      const initialKnownProduct = matchCatalogProduct(observedIdentity, input.catalog);
      const lookupInput: BarboraLookupInput = {
        brand: detection.brand,
        name: detection.productName,
        variant: "",
        packSize,
        searchTerms: [detection.searchQuery]
      };
      const retailerOffer = initialKnownProduct
        ? await getBarboraOfferBySlug(initialKnownProduct.id, lookupInput).catch(() => null)
        : detectionIndex < 6
          ? await resolveBarboraOffer(lookupInput).catch(() => null)
          : null;
      const exactRetailerOffer = retailerOffer?.exactSku ? retailerOffer : null;
      const knownProduct =
        initialKnownProduct ||
        (exactRetailerOffer ? input.catalog.find((product) => product.id === exactRetailerOffer.slug) || null : null);
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
        shelfPrice:
          isTrustedShelfPriceDetection(detection)
            ? {
                amount: detection.shelfPriceCents / 100,
                currency: "EUR",
                observedText: detection.shelfPriceText,
                confidence: detection.shelfPriceConfidence
              }
            : null,
        retailerOffer
      };
    })
  );
  const detections = dedupeProductDetections(resolvedDetections);

  return {
    requestId: input.requestId,
    status: detections.length ? "matched" : "not_sure",
    detections,
    latencyMs: Math.round(performance.now() - startedAt),
    model,
    imageStored: false
  };
}
