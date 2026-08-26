import { createClient } from "@supabase/supabase-js";
import manifests from "../data/catalog-sources.generated.json";
import livinProducts from "../data/livin-catalog.generated.json";
import offProducts from "../data/open-food-facts-lv.generated.json";
import rimiProducts from "../data/rimi-catalog.generated.json";
import type { CatalogSourceManifest, ExternalCatalogProduct } from "../src/server/external-catalog-types";

const BATCH_SIZE = 500;

async function main() {
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

  const retailerRows = ([...(rimiProducts as ExternalCatalogProduct[]), ...(livinProducts as ExternalCatalogProduct[])])
    .map((product) => ({
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
      total_sugar_g_100: product.totalSugarG,
      image_url: product.imageUrl,
      price: product.price,
      currency: product.currency,
      available: product.available,
      checked_at: product.checkedAt
    }));
  for (let index = 0; index < retailerRows.length; index += BATCH_SIZE) {
    const { error } = await supabase.from("retailer_catalog_products").upsert(
      retailerRows.slice(index, index + BATCH_SIZE),
      { onConflict: "source_id,source_product_id" }
    );
    if (error) throw error;
  }

  const offRows = (offProducts as ExternalCatalogProduct[]).map((product) => ({
    gtin: product.gtin,
    source_product_id: product.sourceProductId,
    url: product.url,
    title: product.title,
    brand: product.brand,
    category: product.category,
    pack_size: product.packSize,
    nutrition_basis: product.nutritionBasis,
    energy_kcal_100: product.energyKcal,
    protein_g_100: product.proteinG,
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
  console.log(`Seeded ${sourceRows.length} sources, ${retailerRows.length} retailer rows and ${offRows.length} ODbL rows.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
