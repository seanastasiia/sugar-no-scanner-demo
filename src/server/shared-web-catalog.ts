import { createHash } from "node:crypto";
import { z } from "zod";
import type { ProductRecord, ScoredProduct } from "@/lib/types";
import { scoreReferenceProduct } from "@/lib/scoring";
import { getSupabaseAdmin } from "./supabase";
import { approvedWebProductUrl, validWebGtin, webLookupKey, type VerifiedWebProduct, type WebProductLookup } from "./web-product-evidence";
import { parseShelfEvidence } from "./personal-shelf-evidence";

const nutrient = z.number().min(0).max(100).nullable();
const recordSchema = z.object({
  id: z.string().regex(/^web:shared:[a-f0-9]{24}$/), retailerProductId: z.string(),
  brand: z.string().min(1).max(120), name: z.string().min(1).max(240), shortName: z.string(),
  aliases: z.array(z.string()), format: z.literal("other"), category: z.null(), packSizeG: z.number().positive(),
  nutritionBasis: z.enum(["100g", "100ml"]).nullish(), energyKcalPer100: z.number().min(0).max(1000).nullable(),
  gtin: z.string().nullable(), nutrientsPer100g: z.object({ proteinG: nutrient, fiberG: nutrient, totalSugarG: nutrient, carbohydrateG: nutrient }),
  noAddedSugarClaim: z.literal(false), imageUrl: z.null(), retailerUrl: z.string(), isGolden: z.literal(false), accent: z.literal("coral"),
  canonicalShelfEvidence: z.unknown().optional(),
  sources: z.array(z.object({ label: z.string(), url: z.string(), checkedAt: z.string().datetime(),
    fields: z.array(z.enum(["identity", "protein", "fiber", "totalSugar", "carbohydrate"])), status: z.literal("secondary") })).min(1)
});

export function sharedRecordToProduct(value: unknown): ScoredProduct | null {
  const parsed = recordSchema.safeParse(value);
  if (!parsed.success || !approvedWebProductUrl(parsed.data.retailerUrl) ||
    parsed.data.sources.some((source) => !approvedWebProductUrl(source.url))) return null;
  const { canonicalShelfEvidence, ...raw } = parsed.data;
  const listed = raw.nutrientsPer100g;
  const consistent = !(listed.totalSugarG !== null && listed.carbohydrateG !== null && listed.totalSugarG > listed.carbohydrateG) &&
    (listed.proteinG || 0) + (listed.carbohydrateG || 0) <= 101 &&
    !(listed.proteinG !== null && raw.energyKcalPer100 !== null && listed.proteinG * 4 > raw.energyKcalPer100 + 5);
  const nutrients = raw.nutritionBasis && consistent ? listed : { proteinG: null, fiberG: null, totalSugarG: null, carbohydrateG: null };
  const fieldValues = { identity: true, protein: nutrients.proteinG, fiber: nutrients.fiberG, totalSugar: nutrients.totalSugarG, carbohydrate: nutrients.carbohydrateG };
  const canonical = process.env.SHARED_WEB_SHELF_EVIDENCE_ENABLED === "true" ? parseShelfEvidence(canonicalShelfEvidence) : null;
  const exact = canonical && canonical.sourceUrl === raw.retailerUrl && canonical.source !== "open_food_facts" &&
    (!raw.gtin || !canonical.gtin || validWebGtin(raw.gtin) === validWebGtin(canonical.gtin)) &&
    raw.sources.some((s) => s.url === canonical.sourceUrl && s.checkedAt === canonical.checkedAt) &&
    raw.nutritionBasis === canonical.nutritionBasis && raw.energyKcalPer100 === canonical.energyKcal &&
    nutrients.proteinG === canonical.proteinG && nutrients.totalSugarG === canonical.totalSugarG && nutrients.fiberG === canonical.fiberG &&
    nutrients.carbohydrateG === (canonical.carbohydrateG ?? null) ? canonical : null;
  const record: ProductRecord = { ...raw, nutritionBasis: raw.nutritionBasis || undefined,
    // Only normalize the proven equivalent GTIN representation (e.g. EAN-13
    // versus zero-padded GTIN-14); composition still belongs to this one page.
    ...(exact ? { shelfEvidence: { ...exact, productId: raw.id, gtin: raw.gtin || exact.gtin } } : {}),
    energyKcalPer100: raw.nutritionBasis && consistent ? raw.energyKcalPer100 : null, nutrientsPer100g: nutrients,
    sources: raw.sources.map((source) => ({ ...source, fields: source.fields.filter((field) => fieldValues[field] !== null) })) };
  return scoreReferenceProduct(record, "web_search_reference", "web_search_reference_partial");
}

function enabled() { return process.env.SHARED_WEB_CATALOG_ENABLED === "true"; }
const signal = () => AbortSignal.timeout(1500);

export async function getSharedWebProduct(id: string): Promise<ScoredProduct | null> {
  if (!enabled() || !/^web:shared:[a-f0-9]{24}$/.test(id)) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  try {
    const { data, error } = await db.from("shared_web_products").select("record").eq("id", id).abortSignal(signal()).maybeSingle();
    return error || !data ? null : sharedRecordToProduct(data.record);
  } catch { return null; }
}

export async function findSharedWebProduct(input: WebProductLookup): Promise<{ product: ScoredProduct; checkedAt: string } | null> {
  if (!enabled()) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  try {
    const { data, error } = await db.from("shared_web_product_aliases")
      .select("blocked,shared_web_products(record,checked_at)").eq("alias_key", webLookupKey(input)).abortSignal(signal()).maybeSingle();
    if (error || !data || data.blocked) return null;
    const joined = data.shared_web_products as unknown as { record: unknown; checked_at: string } | null;
    const product = sharedRecordToProduct(joined?.record);
    return product && joined ? { product, checkedAt: joined.checked_at } : null;
  } catch { return null; }
}

export async function findSharedWebProductByBarcode(barcode: string): Promise<ScoredProduct | null> {
  const gtin = validWebGtin(barcode);
  if (!enabled() || !gtin) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  try {
    const { data, error } = await db.from("shared_web_products").select("record")
      .eq("record->>gtin", gtin).limit(2).abortSignal(signal());
    // Multiple source/market cards are ambiguous, not a first-row-wins match.
    return !error && data?.length === 1 ? sharedRecordToProduct(data[0].record) : null;
  } catch { return null; }
}

export async function promoteSharedWebProduct(input: WebProductLookup, observation: VerifiedWebProduct): Promise<{ status: "accepted"; product: ScoredProduct } | { status: "unavailable" | "conflict" }> {
  const product = sharedRecordToProduct(observation.product);
  if (!product) return { status: "conflict" };
  if (!enabled()) return { status: "unavailable" };
  const db = getSupabaseAdmin();
  if (!db) return { status: "unavailable" };
  // Exclude timestamps so identical observations do not grow history forever.
  const canonical = observation.product.canonicalShelfEvidence;
  const fingerprint = { identityKey: observation.identityKey, alias: webLookupKey(input), product: { ...observation.product,
    ...(canonical ? { canonicalShelfEvidence: { ...canonical, checkedAt: undefined } } : {}),
    sources: observation.product.sources.map((source) => ({ label: source.label, url: source.url, fields: source.fields, status: source.status })) } };
  try {
    const { data, error } = await db.rpc("promote_shared_web_product", {
      p_alias_key: webLookupKey(input), p_identity_key: observation.identityKey, p_record: observation.product,
      p_version_hash: createHash("sha256").update(JSON.stringify(fingerprint)).digest("hex")
    }).abortSignal(signal());
    if (error) { console.info("shared_web_catalog_write_unavailable", error.code); return { status: "unavailable" }; }
    const accepted = data?.status === "accepted" ? sharedRecordToProduct(data.record) : null;
    return accepted ? { status: "accepted", product: accepted } : { status: "conflict" };
  } catch { return { status: "unavailable" }; }
}
