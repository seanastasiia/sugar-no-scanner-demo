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
}

export async function readPersistentWebNutrition(
  cacheKey: string,
  now = new Date()
): Promise<{ result: PersistedWebNutritionResolution | null; expiresAt: number } | undefined> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return undefined;
  try {
    const { data, error } = await supabase
      .from("web_nutrition_cache")
      .select("cache_key,status,result,expires_at")
      .eq("cache_key", cacheKey)
      .gt("expires_at", now.toISOString())
      .maybeSingle();
    if (error || !data) return undefined;
    const row = data as WebNutritionCacheRow;
    const expiresAt = Date.parse(row.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return undefined;
    return { result: row.status === "success" ? row.result : null, expiresAt };
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
  expiresAt: number;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  try {
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
        checked_at: new Date().toISOString(),
        expires_at: new Date(input.expiresAt).toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: "cache_key" }
    );
    if (error) return;
  } catch {
    // Supabase is an optimization. Recognition must still work if it is unavailable.
  }
}
