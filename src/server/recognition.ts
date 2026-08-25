import { GoogleGenAI, ThinkingLevel, createPartFromBase64, createPartFromText } from "@google/genai";
import { z } from "zod";
import { dedupeProductDetections } from "@/lib/product-detection-dedupe";
import { scoreReferenceProduct } from "@/lib/scoring";
import type {
  ProductRecord,
  ProductDetection,
  RecognitionMode,
  RecognitionResponse,
  RecognizedProductIdentity,
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
import { nutritionLabelToScoredProduct, type NutritionLabelRead } from "./nutrition-label";
import { resolveOpenFoodFactsProduct } from "./open-food-facts";

export const DEFAULT_GEMINI_MODEL = "gemini-3.7-flash";
const DEFAULT_RECOGNITION_THRESHOLD = 0.72;
const DEFAULT_FOCUSED_RECOGNITION_THRESHOLD = 0.58;

const providerResponseSchema = z.object({
  detections: z.array(
    z.object({
      brand: z.string().max(80),
      productName: z.string().max(180),
      searchQuery: z.string().max(240),
      barcode: z.string().max(14),
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

const candidateConfirmationResponseSchema = z.object({
  choices: z.array(
    z.object({
      detectionIndex: z.number().int().min(0).max(7),
      candidateSlug: z.string().max(220),
      confidence: z.number().min(0).max(1),
      evidence: z.string().max(220)
    })
  ).max(4)
});

export interface CandidateConfirmationSet {
  detectionIndex: number;
  candidates: VisualBarboraCandidate[];
}

export interface CandidateConfirmationChoice {
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

const nutritionLabelResponseSchema = z.object({
  basis: z.enum(["100g", "100ml", "unknown"]),
  energyKcal: z.number().min(0).max(1_000),
  proteinG: z.number().min(0).max(100),
  totalSugarG: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  observedText: z.string().max(600)
});

const sampleShelf: ProductDetection[] = [
  {
    productId: "prot-bat-sal-riekst-saldin-barebells-55-g",
    confidence: 0.98,
    box: { x: 0.01, y: 0.27, width: 0.24, height: 0.28 },
    observedText: "Barebells Salty Peanut",
    shelfPrice: {
      amount: 3.49,
      currency: "EUR",
      observedText: "Demo shelf price €3.49",
      confidence: 1
    },
    retailerOffer: {
      retailer: "Barbora",
      slug: "prot-bat-sal-riekst-saldin-barebells-55-g",
      title: "Proteīna batoniņš ar sāļiem riekstiem BAREBELLS 55g",
      brand: "BAREBELLS",
      url: "https://barbora.lv/produkti/prot-bat-sal-riekst-saldin-barebells-55-g",
      price: 2.79,
      currency: "EUR",
      unitPrice: 50.73,
      unit: "kg",
      imageUrl: "https://cdn.barbora.lv/products/25f716c3-1604-41de-8679-7f4231725f41_s.png",
      checkedAt: "2026-08-25T06:37:00.000Z",
      matchConfidence: 1,
      exactSku: true
    }
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

function checkoutReferenceProduct(
  product: ProductRecord,
  basis: "manufacturer_reference" | "food_composition_reference"
): ScoredProduct {
  return scoreReferenceProduct(product, basis, `${basis}_partial`);
}

const checkoutSproud = checkoutReferenceProduct(
  {
    id: "visual:sproud-barista-low-sugar-high-in-protein-drink-made-from-peas-1l",
    retailerProductId: "visual:sproud-barista-low-sugar-high-in-protein-drink-made-from-peas-1l",
    brand: "SPROUD",
    name: "Barista pea drink 1L",
    shortName: "Barista pea drink 1L",
    aliases: ["Sproud Barista", "Barista Low Sugar High in Protein Drink Made from Peas"],
    format: "other",
    category: "Plant-based drinks",
    packSizeG: 1000,
    nutritionBasis: "100ml",
    energyKcalPer100: 40,
    gtin: null,
    nutrientsPer100g: { proteinG: 2.1, fiberG: null, totalSugarG: 1.8 },
    noAddedSugarClaim: false,
    imageUrl: null,
    retailerUrl: "https://besproud.com/sv/products/barista/",
    sources: [
      {
        label: "Sproud official product page",
        url: "https://besproud.com/sv/products/barista/",
        checkedAt: "2026-08-25",
        fields: ["identity", "protein", "totalSugar"],
        status: "verified"
      }
    ],
    isGolden: false,
    accent: "mint"
  },
  "manufacturer_reference"
);

const checkoutSchnitzer = checkoutReferenceProduct(
  {
    id: "visual:schnitzer-bio-burger-buns",
    retailerProductId: "visual:schnitzer-bio-burger-buns",
    brand: "SCHNITZER",
    name: "Bio Burger Buns gluten-free 250g",
    shortName: "Bio Burger Buns 250g",
    aliases: ["Schnitzer Bio Burger Buns", "Bio Burger Buns"],
    format: "other",
    category: "Gluten-free bakery",
    packSizeG: 250,
    nutritionBasis: "100g",
    energyKcalPer100: 229,
    gtin: "4022993046076",
    nutrientsPer100g: { proteinG: 3.4, fiberG: null, totalSugarG: 3.7 },
    noAddedSugarClaim: false,
    imageUrl: null,
    retailerUrl: "https://www.schnitzer.eu/en/products/bio-burger-buns-glutenfrei",
    sources: [
      {
        label: "Schnitzer official product page",
        url: "https://www.schnitzer.eu/en/products/bio-burger-buns-glutenfrei",
        checkedAt: "2026-08-25",
        fields: ["identity", "protein", "totalSugar"],
        status: "verified"
      }
    ],
    isGolden: false,
    accent: "sun"
  },
  "manufacturer_reference"
);

const checkoutChanterelles = checkoutReferenceProduct(
  {
    id: "visual:stockmann-gailenes-chanterelles",
    retailerProductId: "visual:stockmann-gailenes-chanterelles",
    brand: "STOCKMANN",
    name: "Fresh chanterelles",
    shortName: "Fresh chanterelles",
    aliases: ["Gailenes", "Chanterelles"],
    format: "other",
    category: "Fresh mushrooms",
    packSizeG: 100,
    nutritionBasis: "100g",
    energyKcalPer100: 17,
    gtin: null,
    nutrientsPer100g: { proteinG: 2, fiberG: null, totalSugarG: 0.4 },
    noAddedSugarClaim: false,
    imageUrl: null,
    retailerUrl: "https://www.matvaretabellen.no/en/mushroom-chantherelle-raw/",
    sources: [
      {
        label: "Norwegian Food Composition Table · raw chanterelle reference",
        url: "https://www.matvaretabellen.no/en/mushroom-chantherelle-raw/",
        checkedAt: "2026-08-25",
        fields: ["protein", "totalSugar"],
        status: "secondary"
      }
    ],
    isGolden: false,
    accent: "forest"
  },
  "food_composition_reference"
);

const sampleCheckout: ProductDetection[] = [
  {
    productId: "visual:sproud-barista-low-sugar-high-in-protein-drink-made-from-peas-1l",
    catalogProductId: null,
    confidence: 0.95,
    box: { x: 0.6996165, y: 0.4544577, width: 0.3003835, height: 0.2709955 },
    observedText: "Barista Low Sugar High in Protein Drink Made from Peas 1L",
    identity: {
      brand: "Sproud",
      name: "Barista Low Sugar High in Protein Drink Made from Peas 1L",
      variant: null,
      packSize: "1L",
      category: null,
      matchKind: "visual_only"
    },
    shelfPrice: null,
    retailerOffer: null,
    nutritionLinkConfidence: 1,
    inlineProduct: checkoutSproud
  },
  {
    productId: "visual:schnitzer-bio-burger-buns",
    catalogProductId: null,
    confidence: 0.92,
    box: { x: 0.109558, y: 0.3864703, width: 0.4120444, height: 0.2015259 },
    observedText: "Bio Burger Buns",
    identity: {
      brand: "Schnitzer",
      name: "Bio Burger Buns",
      variant: null,
      packSize: null,
      category: null,
      matchKind: "visual_only"
    },
    shelfPrice: null,
    retailerOffer: null,
    nutritionLinkConfidence: 1,
    inlineProduct: checkoutSchnitzer
  },
  {
    productId: "visual:stockmann-gailenes-chanterelles",
    catalogProductId: null,
    confidence: 0.88,
    box: { x: 0.3670691, y: 0.5989704, width: 0.4562281, height: 0.2684725 },
    observedText: "Gailenes Chanterelles",
    identity: {
      brand: "Stockmann",
      name: "Gailenes Chanterelles",
      variant: null,
      packSize: null,
      category: null,
      matchKind: "visual_only"
    },
    shelfPrice: null,
    retailerOffer: null,
    nutritionLinkConfidence: 0.86,
    inlineProduct: checkoutChanterelles
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

export function nutritionLabelInstruction(identity: RecognizedProductIdentity): string {
  const target = [identity.brand, identity.name, identity.variant, identity.packSize].filter(Boolean).join(" · ");
  return (
    `The user turned around this already recognized product: ${target}. ` +
    `Read only the printed nutrition declaration in this frame. Find one column explicitly labelled per 100 g or per 100 ml. ` +
    `Return energy in kcal, protein in grams and total sugars (the "of which sugars" value) in grams from that same column. ` +
    `Copy the relevant lines exactly into observedText, including the per-100 basis, field labels, values and units. ` +
    `Do not use front-of-pack claims, serving values, carbohydrates, added sugar or estimates. ` +
    `If the table, basis or any required value is unreadable, set basis to unknown, all numeric values and confidence to zero, ` +
    `and describe only what was actually readable in observedText.`
  );
}

async function recognizeNutritionLabel(input: {
  ai: GoogleGenAI;
  model: string;
  mimeType: string;
  base64: string;
  targetIdentity: RecognizedProductIdentity;
  requestId: string;
  startedAt: number;
}): Promise<RecognitionResponse> {
  const response = await input.ai.models.generateContent({
    model: input.model,
    contents: [
      createPartFromText(nutritionLabelInstruction(input.targetIdentity)),
      createPartFromBase64(input.base64, input.mimeType)
    ],
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["basis", "energyKcal", "proteinG", "totalSugarG", "confidence", "observedText"],
        properties: {
          basis: { type: "string", enum: ["100g", "100ml", "unknown"] },
          energyKcal: { type: "number", minimum: 0, maximum: 1000 },
          proteinG: { type: "number", minimum: 0, maximum: 100 },
          totalSugarG: { type: "number", minimum: 0, maximum: 100 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          observedText: { type: "string", maxLength: 600 }
        }
      }
    }
  });
  const read = nutritionLabelResponseSchema.parse(
    JSON.parse(
      response.text ||
        '{"basis":"unknown","energyKcal":0,"proteinG":0,"totalSugarG":0,"confidence":0,"observedText":""}'
    )
  ) as NutritionLabelRead;
  const product = nutritionLabelToScoredProduct(input.targetIdentity, read);
  if (!product) {
    return {
      requestId: input.requestId,
      status: "not_sure",
      detections: [],
      latencyMs: Math.round(performance.now() - input.startedAt),
      model: input.model,
      imageStored: false
    };
  }
  return {
    requestId: input.requestId,
    status: "matched",
    detections: [
      {
        productId: product.id,
        catalogProductId: null,
        confidence: read.confidence,
        box: { x: 0.08, y: 0.08, width: 0.84, height: 0.84 },
        observedText: read.observedText,
        identity: { ...input.targetIdentity, matchKind: "package_label" },
        shelfPrice: null,
        retailerOffer: null,
        nutritionLinkConfidence: read.confidence,
        inlineProduct: product
      }
    ],
    latencyMs: Math.round(performance.now() - input.startedAt),
    model: input.model,
    imageStored: false
  };
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
    : `Scan the complete frame from left to right and top to bottom. Identify every distinct clearly readable front-facing ` +
      `packaged retail SKU, including several different products on the same shelf, up to the response limit. ` +
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
    `searchQuery should repeat the identity using useful English or Latvian equivalents of foreign flavor words for retailer matching. ` +
    `If a complete EAN-8, EAN-13 or UPC barcode number is clearly readable, return only its digits in barcode; otherwise return an empty string. ` +
    `Only when a separate physical shelf price label outside the package is clearly visible and associated with that exact package, ` +
    `set shelfPriceLabelVisible true and return its EUR price in cents, the exact observed price text including € or EUR, and a separate confidence. ` +
    `Otherwise set shelfPriceLabelVisible false, price cents and confidence to zero, and price text to an empty string. ` +
    `Never treat nutrition claims, pack size, deposit text or any number printed on the package as a shelf price. ` +
    `Return an empty detections array rather than guessing when no product identity is readable. ` +
    `Return at most one box per distinct front-facing SKU and do not enumerate repeated or blurry background packages. ` +
    `Boxes use x, y, width and height normalized from 0 to 1.`
  );
}

function lookupInputForDetection(detection: ProviderDetection): BarboraLookupInput {
  const packSize = extractPackSize(detection.productName);
  return {
    brand: detection.brand,
    name: detection.productName,
    variant: "",
    packSize,
    searchTerms: [detection.searchQuery]
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
  if (!candidate.imageUrl) return null;
  try {
    const response = await fetch(candidate.imageUrl, { signal: AbortSignal.timeout(2_500) });
    const mimeType = response.headers.get("content-type")?.split(";")[0] || "";
    if (!response.ok || !/^image\/(?:jpeg|png|webp)$/.test(mimeType)) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 750_000) return null;
    return { candidate, base64: bytes.toString("base64"), mimeType };
  } catch {
    return null;
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
  resolveIndexedCandidate?: typeof resolveIndexedBarboraCandidate;
}

const defaultResolutionDependencies: DetectionResolutionDependencies = {
  getOfferBySlug: getBarboraOfferBySlug,
  resolveOffer: resolveBarboraOffer,
  resolveOpenFoodFacts: resolveOpenFoodFactsProduct,
  resolveIndexedCandidate: resolveIndexedBarboraCandidate
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
  visible: ConfirmedProviderDetection[],
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
    const lookupInput = lookupInputForDetection(detection);
    const indexedBarboraMatch = initialCatalogMatch
      ? null
      : detection.confirmedBarboraSlug
        ? { slug: detection.confirmedBarboraSlug, score: 1 }
        : (dependencies.resolveIndexedCandidate || resolveIndexedBarboraCandidate)(lookupInput);
    const retailerOffer = initialCatalogMatch
      ? await dependencies.getOfferBySlug(initialCatalogMatch.product.id, lookupInput).catch(() => null)
      : indexedBarboraMatch
        ? await dependencies.getOfferBySlug(indexedBarboraMatch.slug, lookupInput).catch(() => null)
        : await dependencies.resolveOffer(lookupInput).catch(() => null);
    const exactRetailerOffer = retailerOffer?.exactSku ? retailerOffer : null;
    // Barbora is the Latvia-primary source and its broad local index is free to
    // query. Use Open Food Facts only after that exact-SKU path fails so a shelf
    // does not spend the community search API's strict per-IP request budget on
    // products that are already resolved locally.
    const openFoodFactsCandidate = initialCatalogMatch || indexedBarboraMatch || exactRetailerOffer
      ? null
      : await dependencies.resolveOpenFoodFacts(lookupInput, detection.barcode).catch(() => null);
    const knownProduct =
      initialCatalogMatch?.product ||
      (exactRetailerOffer ? catalog.find((product) => product.id === exactRetailerOffer.slug) || null : null);
    const openFoodFacts = knownProduct || indexedBarboraMatch || exactRetailerOffer ? null : openFoodFactsCandidate;
    const resolvedProduct = knownProduct || openFoodFacts?.product || null;
    const nutritionLinkConfidence =
      initialCatalogMatch?.confidence ??
      indexedBarboraMatch?.score ??
      exactRetailerOffer?.matchConfidence ??
      openFoodFacts?.confidence ??
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
        category: null,
        matchKind: knownProduct
          ? "verified_catalog"
          : indexedBarboraMatch || exactRetailerOffer
            ? "barbora"
            : openFoodFacts
              ? "open_food_facts"
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
  mode?: RecognitionMode;
  targetIdentity?: RecognizedProductIdentity;
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
  if (input.mode === "nutrition-label") {
    if (!input.targetIdentity) {
      return {
        requestId: input.requestId,
        status: "not_sure",
        detections: [],
        latencyMs: Math.round(performance.now() - startedAt),
        model,
        imageStored: false
      };
    }
    return recognizeNutritionLabel({
      ai,
      model,
      mimeType,
      base64,
      targetIdentity: input.targetIdentity,
      requestId: input.requestId,
      startedAt
    });
  }
  const response = await ai.models.generateContent({
    model,
    contents: [
      createPartFromText(
        recognitionInstruction(focusMode, input.source === "upload" ? "saved-image" : "live-camera")
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
                "barcode",
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
                barcode: { type: "string", maxLength: 14 },
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
  const confirmedVisible = await confirmAmbiguousBarboraCandidates({
    ai,
    model,
    mimeType,
    base64,
    detections: visible,
    allowSingleCandidate: input.source === "upload"
  });
  const detections = await resolveVisibleDetections(confirmedVisible, input.catalog);

  return {
    requestId: input.requestId,
    status: detections.length ? "matched" : "not_sure",
    detections,
    latencyMs: Math.round(performance.now() - startedAt),
    model,
    imageStored: false
  };
}
