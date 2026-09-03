import snapshot from "../../data/personal-shelf-evidence.generated.json";
import type { ShelfEvidence } from "@/lib/personal-shelf-rank";
import { hasSafeShelfSource } from "@/lib/personal-shelf-rank";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabase";

const byId = new Map((snapshot as ShelfEvidence[]).map((row) => [row.productId, row]));

/** No alias/brand/GTIN-only fallback: a different market recipe must not inherit composition. */
export function getShelfEvidence(productId: string): ShelfEvidence | null {
  return byId.get(productId) || null;
}

const nullableAmount = z.number().finite().nonnegative().nullable();
const evidenceSchema = z.object({
  productId: z.string().min(1).max(240), source: z.enum(["barbora_lv", "livinn_lt", "open_food_facts"]),
  sourceUrl: z.string().max(2_000), checkedAt: z.string().refine((s) => Number.isFinite(Date.parse(s))),
  gtin: z.string().regex(/^\d{8,14}$/).nullable(), category: z.string().max(2_000), nutritionBasis: z.enum(["100g", "100ml"]),
  ingredientsText: z.string().max(12_000).nullable(), ingredientsLanguage: z.string().max(10).nullable(),
  energyKcal: nullableAmount, proteinG: nullableAmount, totalSugarG: nullableAmount, fiberG: nullableAmount,
  saltG: nullableAmount, saturatedFatG: nullableAmount
}).refine(hasSafeShelfSource);

/** Read only by canonical IDs, in isolated source tables. An absent migration is a local fallback. */
export async function loadShelfEvidence(ids: string[]): Promise<Record<string, ShelfEvidence>> {
  const result: Record<string, ShelfEvidence> = {};
  for (const id of ids) {
    const local = getShelfEvidence(id);
    if (local) result[id] = local;
  }
  const db = getSupabaseAdmin();
  if (!db) return result;
  await Promise.all(["retailer_shelf_evidence", "open_food_facts_shelf_evidence"].map(async (table) => {
    const keys = ids.filter((id) => table.startsWith("open_food_facts") ? id.startsWith("off:") : /^(?:barbora|livinn_lt):/.test(id));
    if (!keys.length) return;
    try {
      const { data, error } = await db.from(table).select("product_id,evidence").in("product_id", keys).abortSignal(AbortSignal.timeout(2_000));
      if (error) return;
      for (const row of data || []) {
        const parsed = evidenceSchema.safeParse(row.evidence);
        if (!parsed.success || parsed.data.productId !== row.product_id || !keys.includes(row.product_id)) continue;
        const e = parsed.data;
        if ((e.source === "open_food_facts") !== table.startsWith("open_food_facts")) continue;
        if (e.source === "barbora_lv" && !e.productId.startsWith("barbora:")) continue;
        if (e.source === "livinn_lt" && !e.productId.startsWith("livinn_lt:")) continue;
        if (!result[e.productId] || Date.parse(e.checkedAt) > Date.parse(result[e.productId].checkedAt)) result[e.productId] = e;
      }
    } catch { /* Missing table, timeout or offline DB must not remove local evidence. */ }
  }));
  return result;
}
