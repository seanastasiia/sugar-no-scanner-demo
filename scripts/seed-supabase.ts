import catalog from "../data/catalog.generated.json";
import { createClient } from "@supabase/supabase-js";
import type { ProductRecord } from "../src/lib/types";

async function main() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const products = catalog as ProductRecord[];
  const productRows = products.map((product) => ({
    id: product.id,
    retailer_product_id: product.retailerProductId,
    brand: product.brand,
    name: product.name,
    short_name: product.shortName,
    aliases: product.aliases,
    format: product.format,
    pack_size_g: product.packSizeG,
    gtin: product.gtin,
    protein_g_100: product.nutrientsPer100g.proteinG,
    fiber_g_100: product.nutrientsPer100g.fiberG,
    total_sugar_g_100: product.nutrientsPer100g.totalSugarG,
    no_added_sugar_claim: product.noAddedSugarClaim,
    image_url: product.imageUrl,
    retailer_url: product.retailerUrl,
    is_golden: product.isGolden,
    accent: product.accent,
    updated_at: new Date().toISOString()
  }));
  const { error: productError } = await supabase.from("products").upsert(productRows);
  if (productError) throw productError;

  const sources = products.flatMap((product) =>
    product.sources.map((source) => ({
      product_id: product.id,
      label: source.label,
      url: source.url,
      checked_at: source.checkedAt,
      fields: source.fields,
      status: source.status
    }))
  );
  const { error: sourceError } = await supabase
    .from("product_sources")
    .upsert(sources, { onConflict: "product_id,url" });
  if (sourceError) throw sourceError;

  const offers = products.map((product) => ({
    product_id: product.id,
    retailer: "Barbora",
    url: product.retailerUrl,
    affiliate: false,
    checked_at: product.sources[0]?.checkedAt || new Date().toISOString().slice(0, 10),
    active: true
  }));
  const { error: offerError } = await supabase
    .from("retailer_offers")
    .upsert(offers, { onConflict: "product_id,retailer" });
  if (offerError) throw offerError;

  console.log(`Seeded ${products.length} products, ${sources.length} sources and ${offers.length} offers.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
