import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import barboraNutritionProducts from "../data/barbora-nutrition-index.generated.json";
import manifests from "../data/catalog-sources.generated.json";
import lidlFoodIdentities from "../data/lidl-food-index.generated.json";
import livinProducts from "../data/livin-catalog.generated.json";
import livinnFoodIdentities from "../data/livinn-food-index.generated.json";
import livinnProducts from "../data/livinn-catalog.generated.json";
import offProducts from "../data/open-food-facts-lv.generated.json";
import offIdentities from "../data/open-food-facts-regional-identities.generated.json";
import regionalOffProducts from "../data/open-food-facts-regional.generated.json";
import rimiProducts from "../data/rimi-catalog.generated.json";
import rimiFoodIdentities from "../data/rimi-food-index.generated.json";
import { buildBarboraCatalogSnapshot } from "../src/server/barbora-supabase-catalog";
import type { BarboraNutritionIndexProduct } from "../src/server/barbora-nutrition-index";
import { nutritionRevalidateAfter, priceRevalidateAfter } from "../src/server/data-freshness";
import type { CatalogSourceManifest, ExternalCatalogIdentity, ExternalCatalogProduct } from "../src/server/external-catalog-types";
import { isQuarantinedRetailerNutrition } from "../src/server/retailer-nutrition-quarantine";

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

async function pruneStaleRetailerIdentityRows(
  supabase: SupabaseClient,
  sourceId: "rimi_lv" | "lidl_lv" | "livinn_lt",
  retainedProductIds: Set<string>
): Promise<number> {
  const staleIds: string[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await supabase
      .from("retailer_catalog_food_identities")
      .select("source_product_id")
      .eq("source_id", sourceId)
      .range(from, from + 999);
    if (error) throw error;
    const rows = (data || []) as Array<{ source_product_id: string }>;
    staleIds.push(...rows.filter((row) => !retainedProductIds.has(row.source_product_id)).map((row) => row.source_product_id));
    if (rows.length < 1_000) break;
  }
  for (let index = 0; index < staleIds.length; index += BATCH_SIZE) {
    const { error } = await supabase
      .from("retailer_catalog_food_identities")
      .delete()
      .eq("source_id", sourceId)
      .in("source_product_id", staleIds.slice(index, index + BATCH_SIZE));
    if (error) throw error;
  }
  return staleIds.length;
}

async function pruneStaleOffIdentityRows(
  supabase: SupabaseClient,
  retainedGtins: Set<string>
): Promise<number> {
  const staleGtins: string[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await supabase
      .from("open_food_facts_product_identities")
      .select("gtin")
      .range(from, from + 999);
    if (error) throw error;
    const rows = (data || []) as Array<{ gtin: string }>;
    staleGtins.push(...rows.filter((row) => !retainedGtins.has(row.gtin)).map((row) => row.gtin));
    if (rows.length < 1_000) break;
  }
  for (let index = 0; index < staleGtins.length; index += BATCH_SIZE) {
    const { error } = await supabase
      .from("open_food_facts_product_identities")
      .delete()
      .in("gtin", staleGtins.slice(index, index + BATCH_SIZE));
    if (error) throw error;
  }
  return staleGtins.length;
}

async function main() {
  const snapshotCheckedAt = new Date().toISOString();
  const barbora = buildBarboraCatalogSnapshot({
    nutritionProducts: barboraNutritionProducts as BarboraNutritionIndexProduct[],
    snapshotCheckedAt
  });
  console.log(JSON.stringify({ barbora: barbora.summary }, null, 2));
  console.log(JSON.stringify({ rimiFoodIdentities: (rimiFoodIdentities as ExternalCatalogIdentity[]).length }));
  console.log(JSON.stringify({ lidlFoodIdentities: (lidlFoodIdentities as ExternalCatalogIdentity[]).length }));
  console.log(JSON.stringify({ livinnFoodIdentities: (livinnFoodIdentities as ExternalCatalogIdentity[]).length }));
  console.log(JSON.stringify({ openFoodFactsIdentityOnly: (offIdentities as ExternalCatalogIdentity[]).length }));
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
      ...(livinProducts as ExternalCatalogProduct[]),
      ...(livinnProducts as ExternalCatalogProduct[]).filter((product) => !isQuarantinedRetailerNutrition(product))
    ];
    const retailerIdentityRows = [
      ...(rimiFoodIdentities as ExternalCatalogIdentity[]),
      ...(lidlFoodIdentities as ExternalCatalogIdentity[]),
      ...(livinnFoodIdentities as ExternalCatalogIdentity[])
    ].map((product) => ({
      source_id: product.source,
      source_product_id: product.sourceProductId,
      retailer: product.retailer,
      url: product.url,
      title: product.title,
      aliases: product.aliases,
      brand: product.brand,
      gtin: product.gtin,
      sku: product.sku,
      category: product.category,
      pack_size: product.packSize,
      image_url: product.imageUrl,
      price: product.price,
      currency: product.currency,
      available: product.available,
      checked_at: product.checkedAt
    }));
    for (let index = 0; index < retailerIdentityRows.length; index += BATCH_SIZE) {
      const { error } = await supabase.from("retailer_catalog_food_identities").upsert(
        retailerIdentityRows.slice(index, index + BATCH_SIZE),
        { onConflict: "source_id,source_product_id" }
      );
      if (error) throw error;
    }
    const prunedRetailerIdentityRows = Object.fromEntries(await Promise.all(
      (["rimi_lv", "lidl_lv", "livinn_lt"] as const).map(async (sourceId) => [
        sourceId,
        await pruneStaleRetailerIdentityRows(
          supabase,
          sourceId,
          new Set(retailerIdentityRows.filter((row) => row.source_id === sourceId).map((row) => row.source_product_id))
        )
      ])
    ));
    const retailerRows = [
      ...barbora.productRows,
      ...externalRetailerProducts.map((product) => ({
        source_id: product.source,
        source_product_id: product.sourceProductId,
        retailer: product.retailer,
        url: product.url,
        title: product.title,
        aliases: product.aliases || [],
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

    const combinedOffProducts = [
      ...new Map(
        [...(offProducts as ExternalCatalogProduct[]), ...(regionalOffProducts as ExternalCatalogProduct[])]
          .map((product) => [product.gtin || product.sourceProductId, product] as const)
      ).values()
    ];
    const completeOffGtins = new Set(combinedOffProducts.map((product) => product.gtin));
    const offIdentityRows = (offIdentities as ExternalCatalogIdentity[]).map((product) => ({
      gtin: product.gtin,
      source_product_id: product.sourceProductId,
      url: product.url,
      title: product.title,
      aliases: product.aliases,
      brand: product.brand,
      category: product.category,
      pack_size: product.packSize,
      checked_at: product.checkedAt,
      attribution: "Open Food Facts contributors",
      license: "ODbL-1.0"
    }));
    if (offIdentityRows.some((row) => !row.gtin || completeOffGtins.has(row.gtin))) {
      throw new Error("OFF identity-only rows must have canonical GTINs and remain separate from nutrition-complete rows");
    }
    for (let index = 0; index < offIdentityRows.length; index += BATCH_SIZE) {
      const { error } = await supabase.from("open_food_facts_product_identities").upsert(
        offIdentityRows.slice(index, index + BATCH_SIZE),
        { onConflict: "gtin" }
      );
      if (error) throw error;
    }
    const prunedOffIdentityRows = await pruneStaleOffIdentityRows(
      supabase,
      new Set(offIdentityRows.map((product) => product.gtin!))
    );
    const offRows = combinedOffProducts.map((product) => ({
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
      `${retailerRows.length} nutrition-complete retailer rows, ${retailerIdentityRows.length} retailer food identities ` +
      `${offIdentityRows.length} OFF identity-only rows and ${offRows.length} nutrition-complete ODbL rows; ` +
      `pruned ${prunedBarboraRows} unrated Barbora rows, ${JSON.stringify(prunedRetailerIdentityRows)} stale retailer identities ` +
      `and ${prunedOffIdentityRows} stale OFF identities.`
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
