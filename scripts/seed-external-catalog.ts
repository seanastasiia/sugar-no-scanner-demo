import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import barboraNutritionProducts from "../data/barbora-nutrition-index.generated.json";
import manifests from "../data/catalog-sources.generated.json";
import livinProducts from "../data/livin-catalog.generated.json";
import offProducts from "../data/open-food-facts-lv.generated.json";
import rimiProducts from "../data/rimi-catalog.generated.json";
import { buildBarboraCatalogSnapshot } from "../src/server/barbora-supabase-catalog";
import type { BarboraNutritionIndexProduct } from "../src/server/barbora-nutrition-index";
import { nutritionRevalidateAfter, priceRevalidateAfter } from "../src/server/data-freshness";
import type { CatalogSourceManifest, ExternalCatalogProduct } from "../src/server/external-catalog-types";

const BATCH_SIZE = 500;

function retailerVersionRow(product: ExternalCatalogProduct) {
  return {
    source_id: product.source,
    source_product_id: product.sourceProductId,
    version_hash: createHash("sha256").update(JSON.stringify([
      product.nutritionBasis,
      product.energyKcal,
      product.proteinG,
      product.carbohydrateG,
      product.totalSugarG,
      product.checkedAt
    ])).digest("hex"),
    nutrition_source_kind: "retailer",
    source_url: product.url,
    title: product.title,
    nutrition_basis: product.nutritionBasis,
    energy_kcal_100: product.energyKcal,
    protein_g_100: product.proteinG,
    carbohydrate_g_100: product.carbohydrateG ?? null,
    total_sugar_g_100: product.totalSugarG,
    image_url: product.imageUrl,
    verified_at: product.checkedAt,
    revalidate_after: nutritionRevalidateAfter(product.checkedAt, "retailer")
  };
}

async function pruneUnratedBarboraRows(
  supabase: SupabaseClient,
  retainedProductIds: Set<string>
): Promise<number> {
  const staleIds: string[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await supabase
      .from("retailer_catalog_products")
      .select("source_product_id")
      .eq("source_id", "barbora_lv")
      .range(from, from + 999);
    if (error) throw error;
    const rows = (data || []) as Array<{ source_product_id: string }>;
    staleIds.push(...rows.filter((row) => !retainedProductIds.has(row.source_product_id)).map((row) => row.source_product_id));
    if (rows.length < 1_000) break;
  }
  for (let index = 0; index < staleIds.length; index += BATCH_SIZE) {
    const { error } = await supabase
      .from("retailer_catalog_products")
      .delete()
      .eq("source_id", "barbora_lv")
      .in("source_product_id", staleIds.slice(index, index + BATCH_SIZE));
    if (error) throw error;
  }
  return staleIds.length;
}

async function main() {
  const snapshotCheckedAt = new Date().toISOString();
  const barbora = buildBarboraCatalogSnapshot({
    nutritionProducts: barboraNutritionProducts as BarboraNutritionIndexProduct[],
    snapshotCheckedAt
  });
  console.log(JSON.stringify({ barbora: barbora.summary }, null, 2));
  if (process.argv.includes("--dry-run")) return;

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const sourceRows = (manifests as CatalogSourceManifest[]).map((source) => ({
    id: source.id,
    display_name: source.displayName,
    layer: source.layer,
    license: source.license,
    attribution: source.attribution,
    terms_url: source.termsUrl,
    data_url: source.dataUrl,
    redistributable: source.redistributable,
    updated_at: new Date().toISOString()
  }));
  for (let index = 0; index < sourceRows.length; index += BATCH_SIZE) {
    const { error } = await supabase.from("catalog_sources").upsert(sourceRows.slice(index, index + BATCH_SIZE), { onConflict: "id" });
    if (error) throw error;
  }

  const { data: syncRun, error: syncRunError } = await supabase.from("catalog_sync_runs").upsert({
    source_id: barbora.summary.sourceId,
    status: "running",
    snapshot_checksum: barbora.summary.snapshotChecksum,
    discovered_count: barbora.summary.registryCount,
    registry_count: barbora.summary.registryCount,
    food_count: barbora.summary.registryCount,
    food_outside_discovery_count: 0,
    complete_nutrition_count: barbora.summary.completeNutritionCount,
    priced_count: barbora.summary.pricedCount,
    started_at: snapshotCheckedAt,
    completed_at: null,
    error_message: null
  }, { onConflict: "source_id,snapshot_checksum" }).select("id").single();
  if (syncRunError) throw syncRunError;

  try {
    const externalRetailerProducts = [
      ...(rimiProducts as ExternalCatalogProduct[]),
      ...(livinProducts as ExternalCatalogProduct[])
    ];
    const retailerRows = [
      ...barbora.productRows,
      ...externalRetailerProducts.map((product) => ({
        source_id: product.source,
        source_product_id: product.sourceProductId,
        retailer: product.retailer,
        url: product.url,
        title: product.title,
        brand: product.brand,
        gtin: product.gtin,
        sku: product.sku,
        category: product.category,
        pack_size: product.packSize,
        nutrition_basis: product.nutritionBasis,
        energy_kcal_100: product.energyKcal,
        protein_g_100: product.proteinG,
        carbohydrate_g_100: product.carbohydrateG ?? null,
        total_sugar_g_100: product.totalSugarG,
        image_url: product.imageUrl,
        price: product.price,
        currency: product.currency,
        available: product.available,
        checked_at: product.checkedAt,
        nutrition_source_kind: "retailer",
        nutrition_verified_at: product.checkedAt,
        nutrition_revalidate_after: nutritionRevalidateAfter(product.checkedAt, "retailer"),
        price_verified_at: product.price === null ? null : product.checkedAt,
        price_revalidate_after: product.price === null ? null : priceRevalidateAfter(product.checkedAt),
        snapshot_checked_at: snapshotCheckedAt
      }))
    ];
    for (let index = 0; index < retailerRows.length; index += BATCH_SIZE) {
      const { error } = await supabase.from("retailer_catalog_products").upsert(
        retailerRows.slice(index, index + BATCH_SIZE),
        { onConflict: "source_id,source_product_id" }
      );
      if (error) throw error;
    }
    const prunedBarboraRows = await pruneUnratedBarboraRows(
      supabase,
      new Set(barbora.productRows.map((product) => product.source_product_id))
    );

    const retailerVersionRows = [
      ...barbora.versionRows,
      ...externalRetailerProducts.map(retailerVersionRow)
    ];
    for (let index = 0; index < retailerVersionRows.length; index += BATCH_SIZE) {
      const { error } = await supabase.from("retailer_catalog_product_versions").upsert(
        retailerVersionRows.slice(index, index + BATCH_SIZE),
        { onConflict: "source_id,source_product_id,version_hash" }
      );
      if (error) throw error;
    }

    const offRows = (offProducts as ExternalCatalogProduct[]).map((product) => ({
      gtin: product.gtin,
      source_product_id: product.sourceProductId,
      url: product.url,
      title: product.title,
      aliases: product.aliases || [],
      brand: product.brand,
      category: product.category,
      pack_size: product.packSize,
      nutrition_basis: product.nutritionBasis,
      energy_kcal_100: product.energyKcal,
      protein_g_100: product.proteinG,
      carbohydrate_g_100: product.carbohydrateG ?? null,
      total_sugar_g_100: product.totalSugarG,
      image_url: product.imageUrl,
      checked_at: product.checkedAt,
      attribution: "Open Food Facts contributors",
      license: "ODbL-1.0"
    }));
    for (let index = 0; index < offRows.length; index += BATCH_SIZE) {
      const { error } = await supabase.from("open_food_facts_products").upsert(offRows.slice(index, index + BATCH_SIZE), { onConflict: "gtin" });
      if (error) throw error;
    }
    const { error: completedError } = await supabase.from("catalog_sync_runs").update({
      status: "complete",
      completed_at: new Date().toISOString(),
      error_message: null
    }).eq("id", syncRun.id);
    if (completedError) throw completedError;
    console.log(
      `Seeded ${sourceRows.length} sources, ${barbora.productRows.length} rated Barbora SKUs, ` +
      `${retailerRows.length} nutrition-complete retailer rows and ${offRows.length} ODbL rows; ` +
      `pruned ${prunedBarboraRows} unrated Barbora rows.`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await supabase.from("catalog_sync_runs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: errorMessage.slice(0, 2_000)
    }).eq("id", syncRun.id);
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
