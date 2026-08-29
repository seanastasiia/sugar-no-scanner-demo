import { createHash } from "node:crypto";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { scoreReferenceProduct } from "@/lib/scoring";
import type { ProductRecord, ProductSource, ScoredProduct } from "@/lib/types";
import { normalizeRetailText, type BarboraLookupInput } from "./barbora-catalog";
import { readPersistentWebNutrition, writePersistentWebNutrition } from "./web-nutrition-cache";

const DEFAULT_MODEL = "gemini-3.7-flash";
const MIN_GOOGLE_HTTP_TIMEOUT_MS = 10_000;
const DEFAULT_WEB_NUTRITION_TIMEOUT_MS = 12_000;
const MAX_WEB_NUTRITION_TIMEOUT_MS = 30_000;
// Nutrition for an exact packaged SKU is stable. Keep verified results long
// enough to make repeat investor/store scans local, while retrying misses soon.
const SUCCESS_CACHE_TTL_MS = 30 * 24 * 60 * 60_000;
const MISS_CACHE_TTL_MS = 6 * 60 * 60_000;
const responseCache = new Map<string, { expiresAt: number; result: WebNutritionResolution | null }>();

export function webNutritionTimeoutMs(raw = process.env.GEMINI_WEB_NUTRITION_TIMEOUT_MS): number {
  const parsed = Number.parseInt(raw || "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_WEB_NUTRITION_TIMEOUT_MS;
  return Math.min(MAX_WEB_NUTRITION_TIMEOUT_MS, Math.max(MIN_GOOGLE_HTTP_TIMEOUT_MS, parsed));
}

const groundedNutritionSchema = z.object({
  exactProductMatch: z.boolean(),
  matchedBrand: z.string().max(120),
  matchedProductName: z.string().max(240),
  nutritionBasis: z.enum(["100g", "100ml", "unknown"]),
  energyKcal: z.number().min(0).max(1_000),
  proteinG: z.number().min(0).max(100),
  totalSugarG: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  evidence: z.string().max(500)
});

interface WebNutritionSource {
  title: string;
  url: string;
}

export interface WebNutritionResolution {
  product: ScoredProduct;
  confidence: number;
}

export interface GroundedNutritionCandidate {
  exactProductMatch: boolean;
  matchedBrand: string;
  matchedProductName: string;
  nutritionBasis: "100g" | "100ml" | "unknown";
  energyKcal: number;
  proteinG: number;
  totalSugarG: number;
  confidence: number;
  evidence: string;
}

export function extractGroundedNutritionCandidate(text: string): GroundedNutritionCandidate | null {
  const marked = text.match(/NUTRITION_JSON:\s*(\{[^\n]+\})/i)?.[1];
  const fenced = text.match(/```json\s*(\{[\s\S]*?\})\s*```/i)?.[1];
  const json = marked || fenced;
  if (!json) return null;
  try {
    const parsed = groundedNutritionSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function parsePackSize(value: string): number {
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/i);
  if (!match) return 0;
  const amount = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(amount)) return 0;
  const unit = match[2].toLowerCase();
  return amount * (unit === "kg" || unit === "l" ? 1_000 : unit === "cl" ? 10 : 1);
}

function trustedSources(sources: WebNutritionSource[]): WebNutritionSource[] {
  const seen = new Set<string>();
  return sources
    .filter((source) => {
      try {
        const url = new URL(source.url);
        if (url.protocol !== "https:" || seen.has(url.href)) return false;
        seen.add(url.href);
        return true;
      } catch {
        return false;
      }
    })
    .slice(0, 3);
}

function productSources(sources: WebNutritionSource[], checkedAt: string): ProductSource[] {
  return sources.map((source) => ({
    label: `Web nutrition source · ${source.title || new URL(source.url).hostname}`.slice(0, 180),
    url: source.url,
    checkedAt,
    fields: ["identity", "protein", "totalSugar"],
    status: "secondary"
  }));
}

export function buildGroundedWebNutritionProduct(
  input: BarboraLookupInput,
  candidate: GroundedNutritionCandidate,
  rawSources: WebNutritionSource[],
  checkedAt = new Date().toISOString()
): WebNutritionResolution | null {
  const sources = trustedSources(rawSources);
  if (
    !candidate.exactProductMatch ||
    candidate.confidence < 0.9 ||
    candidate.nutritionBasis === "unknown" ||
    candidate.energyKcal <= 0 ||
    !sources.length
  ) {
    return null;
  }
  const observedIdentity = normalizeRetailText(`${input.brand} ${input.name}`);
  const matchedIdentity = normalizeRetailText(`${candidate.matchedBrand} ${candidate.matchedProductName}`);
  const brand = normalizeRetailText(input.brand);
  if (!brand || !matchedIdentity.includes(brand) || !observedIdentity.split(" ").some((token) => token.length >= 4 && matchedIdentity.includes(token))) {
    return null;
  }

  const identityKey = normalizeRetailText([input.brand, input.name, input.variant, input.packSize].filter(Boolean).join(" "));
  const id = `web:${createHash("sha256").update(identityKey).digest("hex").slice(0, 20)}`;
  const record: ProductRecord = {
    id,
    retailerProductId: id,
    brand: input.brand,
    name: input.name,
    shortName: input.name,
    aliases: [candidate.matchedProductName],
    format: "other",
    category: null,
    packSizeG: parsePackSize(input.packSize || ""),
    nutritionBasis: candidate.nutritionBasis,
    energyKcalPer100: candidate.energyKcal,
    gtin: null,
    nutrientsPer100g: {
      proteinG: candidate.proteinG,
      fiberG: null,
      totalSugarG: candidate.totalSugarG
    },
    noAddedSugarClaim: false,
    imageUrl: null,
    retailerUrl: sources[0].url,
    sources: productSources(sources, checkedAt),
    isGolden: false,
    accent: "coral"
  };
  return {
    product: scoreReferenceProduct(record, "web_search_reference", "web_search_reference_partial"),
    confidence: candidate.confidence
  };
}

export async function resolveWebNutritionProduct(
  input: BarboraLookupInput,
  recognitionConfidence: number
): Promise<WebNutritionResolution | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || recognitionConfidence < 0.78 || !input.brand.trim() || !input.name.trim()) return null;
  const cacheKey = normalizeRetailText([input.brand, input.name, input.variant, input.packSize].filter(Boolean).join(" "));
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const persistent = await readPersistentWebNutrition(cacheKey);
  if (persistent) {
    responseCache.set(cacheKey, persistent);
    return persistent.result;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const normalizedName = normalizeRetailText(input.name);
    const exactProductQuery = [
      input.brand,
      input.name,
      ...[input.variant, input.packSize].filter(
        (part): part is string => Boolean(part && !normalizedName.includes(normalizeRetailText(part)))
      )
    ].join(" ");
    const model = process.env.GEMINI_WEB_NUTRITION_MODEL || process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const response = await ai.models.generateContent({
      model,
      contents:
        `Use Google Search now. Find the exact packaged food "${exactProductQuery}". ` +
        `Search manufacturer, retailer or exact product-database pages for its nutrition table. ` +
        `Return exactProductMatch true only when brand, product, flavor/variant and visible pack identity refer to the same SKU. ` +
        `Return energy kcal, protein and total sugars per 100 g or per 100 ml exactly as a source lists them. ` +
        `Do not estimate, convert serving values, borrow a similar flavor, or average conflicting sources. ` +
        `If an exact per-100 table is not verifiable, return exactProductMatch false with zero nutrients and unknown basis. ` +
        `Cite the supporting page in the answer. End with exactly one single-line JSON object prefixed NUTRITION_JSON:. ` +
        `The object must contain exactProductMatch, matchedBrand, matchedProductName, nutritionBasis as 100g/100ml/unknown, ` +
        `numeric energyKcal, proteinG, totalSugarG and confidence from 0 to 1, plus a short evidence string.`,
      config: {
        httpOptions: { timeout: webNutritionTimeoutMs() },
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        temperature: 0,
        tools: [{ googleSearch: {} }]
      }
    });
    const candidate = extractGroundedNutritionCandidate(response.text || "");
    const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || []).flatMap((chunk) =>
      chunk.web?.uri ? [{ title: chunk.web.title || "Web source", url: chunk.web.uri }] : []
    );
    const result = candidate ? buildGroundedWebNutritionProduct(input, candidate, sources) : null;
    const expiresAt = Date.now() + (result ? SUCCESS_CACHE_TTL_MS : MISS_CACHE_TTL_MS);
    responseCache.set(cacheKey, { result, expiresAt });
    // Await the write so one-off preload jobs cannot exit before Supabase has
    // persisted the result. For interactive scans this happens only after the
    // slower remote lookup and adds a small, bounded cache-write round trip.
    await writePersistentWebNutrition({ ...input, cacheKey, result, model, expiresAt });
    return result;
  } catch (error) {
    console.info(
      JSON.stringify({
        event: "web_nutrition_not_resolved",
        product: `${input.brand} ${input.name}`.slice(0, 240),
        error: error instanceof Error ? error.message : "unknown"
      })
    );
    const expiresAt = Date.now() + MISS_CACHE_TTL_MS;
    responseCache.set(cacheKey, { result: null, expiresAt });
    await writePersistentWebNutrition({
      ...input,
      cacheKey,
      result: null,
      model: process.env.GEMINI_WEB_NUTRITION_MODEL || process.env.GEMINI_MODEL || DEFAULT_MODEL,
      expiresAt
    });
    return null;
  }
}
