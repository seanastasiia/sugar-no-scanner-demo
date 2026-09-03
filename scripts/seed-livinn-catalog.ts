import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import identities from "../data/livinn-food-index.generated.json";
import snapshot from "../data/livinn-catalog.generated.json";
import manifests from "../data/catalog-sources.generated.json";
import { nutritionRevalidateAfter, priceRevalidateAfter } from "../src/server/data-freshness";
import type { ExternalCatalogProduct } from "../src/server/external-catalog-types";
import { isQuarantinedRetailerNutrition } from "../src/server/retailer-nutrition-quarantine";

// Additive, Livinn-only release import. Never rewrites or prunes another source.
async function main() {
  const products = (snapshot as ExternalCatalogProduct[]).filter((p) => !isQuarantinedRetailerNutrition(p));
  const summary = { foodIdentities: identities.length, nutritionRows: products.length, quarantined: snapshot.length - products.length };
  console.log(JSON.stringify({ apply: process.argv.includes("--apply"), ...summary }));
  if (!process.argv.includes("--apply")) return;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const source = manifests.find((entry) => entry.id === "livinn_lt");
  if (!source) throw new Error("Missing Livinn source manifest");
  const { error: sourceError } = await db.from("catalog_sources").upsert({
    id: source.id, display_name: source.displayName, layer: source.layer, license: source.license,
    attribution: source.attribution, terms_url: source.termsUrl, data_url: source.dataUrl,
    redistributable: source.redistributable, updated_at: new Date().toISOString()
  }, { onConflict: "id" });
  if (sourceError) throw sourceError;
  const identityRows = identities.map((p) => ({
    source_id: p.source, source_product_id: p.sourceProductId, retailer: p.retailer,
    url: p.url, title: p.title, aliases: p.aliases, brand: p.brand, gtin: p.gtin,
    sku: p.sku, category: p.category, pack_size: p.packSize, image_url: p.imageUrl,
    price: p.price, currency: p.currency, available: p.available, checked_at: p.checkedAt
  }));
  const productRows = products.map((p) => ({
    source_id: p.source, source_product_id: p.sourceProductId, retailer: p.retailer,
    url: p.url, title: p.title, aliases: p.aliases || [], brand: p.brand, gtin: p.gtin,
    sku: p.sku, category: p.category, pack_size: p.packSize, nutrition_basis: p.nutritionBasis,
    energy_kcal_100: p.energyKcal, protein_g_100: p.proteinG, total_sugar_g_100: p.totalSugarG,
    carbohydrate_g_100: p.carbohydrateG ?? null, image_url: p.imageUrl, price: p.price,
    currency: p.currency, available: p.available, checked_at: p.checkedAt,
    nutrition_source_kind: "retailer", nutrition_verified_at: p.checkedAt,
    nutrition_revalidate_after: nutritionRevalidateAfter(p.checkedAt, "retailer"),
    price_verified_at: p.price === null ? null : p.checkedAt,
    price_revalidate_after: p.price === null ? null : priceRevalidateAfter(p.checkedAt),
    snapshot_checked_at: new Date().toISOString()
  }));
  const versionRows = products.map((p) => ({
    source_id: p.source, source_product_id: p.sourceProductId,
    version_hash: createHash("sha256").update(JSON.stringify([
      p.nutritionBasis, p.energyKcal, p.proteinG, p.carbohydrateG, p.totalSugarG, p.checkedAt
    ])).digest("hex"),
    nutrition_source_kind: "retailer", source_url: p.url, title: p.title,
    nutrition_basis: p.nutritionBasis, energy_kcal_100: p.energyKcal, protein_g_100: p.proteinG,
    total_sugar_g_100: p.totalSugarG, carbohydrate_g_100: p.carbohydrateG ?? null,
    image_url: p.imageUrl, verified_at: p.checkedAt,
    revalidate_after: nutritionRevalidateAfter(p.checkedAt, "retailer")
  }));
  for (const [table, rows, onConflict] of [
    ["retailer_catalog_food_identities", identityRows, "source_id,source_product_id"],
    ["retailer_catalog_products", productRows, "source_id,source_product_id"],
    ["retailer_catalog_product_versions", versionRows, "source_id,source_product_id,version_hash"]
  ] as const) {
    for (let offset = 0; offset < rows.length; offset += 250) {
      const { error } = await db.from(table).upsert(rows.slice(offset, offset + 250), { onConflict });
      if (error) throw error;
    }
    const { count, error } = await db.from(table).select("source_product_id", { head: true, count: "exact" }).eq("source_id", "livinn_lt");
    if (error) throw error;
    if (count !== rows.length) throw new Error(`${table}: expected ${rows.length} Livinn rows, found ${count}`);
    console.log(JSON.stringify({ table, verifiedLivinnRows: count }));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
