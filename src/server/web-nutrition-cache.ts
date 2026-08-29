import { createHash } from "node:crypto";
import type { ScoredProduct } from "@/lib/types";
import { getSupabaseAdmin } from "./supabase";

export interface PersistedWebNutritionResolution {
  product: ScoredProduct;
  confidence: number;
}

interface WebNutritionCacheRow {
  cache_key: string;
  status: "success" | "miss";
  result: PersistedWebNutritionResolution | null;
  expires_at: string;
  revalidate_after: string | null;
}

export async function readPersistentWebNutrition(
  cacheKey: string,
  now = new Date()
): Promise<{
  result: PersistedWebNutritionResolution | null;
  revalidateAfter: number;
  stale: boolean;
} | undefined> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return undefined;
  try {
    const { data, error } = await supabase
      .from("web_nutrition_cache")
      .select("cache_key,status,result,expires_at,revalidate_after")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error || !data) return undefined;
    const row = data as WebNutritionCacheRow;
    const revalidateAfter = Date.parse(row.revalidate_after || row.expires_at);
    if (!Number.isFinite(revalidateAfter)) return undefined;
    const stale = revalidateAfter <= now.getTime();
    // A successful exact-SKU result remains useful forever. A stale miss is
    // retried because it contains no verified nutrition to preserve.
    if (row.status === "miss" && stale) return undefined;
    return { result: row.status === "success" ? row.result : null, revalidateAfter, stale };
  } catch {
    return undefined;
  }
}

export async function writePersistentWebNutrition(input: {
  cacheKey: string;
  brand: string;
  name: string;
  variant?: string | null;
  packSize?: string | null;
  result: PersistedWebNutritionResolution | null;
  model: string;
  revalidateAfter: number;
  preserveVerifiedSuccess?: boolean;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  try {
    if (!input.result && input.preserveVerifiedSuccess) {
      const { data: existing } = await supabase
        .from("web_nutrition_cache")
        .select("status")
        .eq("cache_key", input.cacheKey)
        .maybeSingle();
      if ((existing as { status?: string } | null)?.status === "success") {
        await supabase.from("web_nutrition_cache").update({
          last_revalidation_attempt_at: new Date().toISOString(),
          last_revalidation_error: "No newer exact source-backed result found"
        }).eq("cache_key", input.cacheKey);
        return;
      }
    }

    const checkedAt = new Date().toISOString();
    const revalidateAfter = new Date(input.revalidateAfter).toISOString();
    if (input.result) {
      const versionHash = createHash("sha256").update(JSON.stringify(input.result)).digest("hex");
      const { error: historyError } = await supabase.from("web_nutrition_cache_versions").upsert(
        {
          cache_key: input.cacheKey,
          version_hash: versionHash,
          result: input.result,
          model: input.model,
          verified_at: checkedAt,
          revalidate_after: revalidateAfter
        },
        { onConflict: "cache_key,version_hash" }
      );
      if (historyError) return;
    }
    const { error } = await supabase.from("web_nutrition_cache").upsert(
      {
        cache_key: input.cacheKey,
        brand: input.brand,
        name: input.name,
        variant: input.variant || null,
        pack_size: input.packSize || null,
        status: input.result ? "success" : "miss",
        result: input.result,
        model: input.model,
        checked_at: checkedAt,
        expires_at: revalidateAfter,
        revalidate_after: revalidateAfter,
        last_revalidation_attempt_at: checkedAt,
        last_revalidation_error: null,
        updated_at: checkedAt
      },
      { onConflict: "cache_key" }
    );
    if (error) return;
  } catch {
    // Supabase is an optimization. Recognition must still work if it is unavailable.
  }
}
