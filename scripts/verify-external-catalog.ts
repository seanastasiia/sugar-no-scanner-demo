import { createClient } from "@supabase/supabase-js";
import livinnFoodIdentities from "../data/livinn-food-index.generated.json";
import offIdentities from "../data/open-food-facts-regional-identities.generated.json";
import cspReport from "../data/csp-import-report.generated.json";
import { BARBORA_RATED_PRODUCT_COUNT } from "../src/server/barbora-supabase-catalog";

async function main() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const current = await supabase
    .from("retailer_catalog_products")
    .select("source_product_id", { count: "exact", head: true })
    .eq("source_id", "barbora_lv");
  if (current.error) throw current.error;
  const currentCount = current.count ?? 0;

  const complete = await supabase
    .from("retailer_catalog_products")
    .select("source_product_id", { count: "exact", head: true })
    .eq("source_id", "barbora_lv")
    .not("protein_g_100", "is", null)
    .not("total_sugar_g_100", "is", null);
  if (complete.error) throw complete.error;
  const completeCount = complete.count ?? 0;

  const versions = await supabase
    .from("retailer_catalog_product_versions")
    .select("source_product_id", { count: "exact", head: true })
    .eq("source_id", "barbora_lv");
  if (versions.error) throw versions.error;
  const versionCount = versions.count ?? 0;

  const stale = await supabase
    .from("retailer_catalog_products")
    .select("source_product_id", { count: "exact", head: true })
    .eq("source_id", "barbora_lv")
    .lte("nutrition_revalidate_after", new Date().toISOString());
  if (stale.error) throw stale.error;
  const staleCount = stale.count ?? 0;

  const livinnIdentities = await supabase
    .from("retailer_catalog_food_identities")
    .select("source_product_id", { count: "exact", head: true })
    .eq("source_id", "livinn_lt");
  if (livinnIdentities.error) throw livinnIdentities.error;
  const livinnIdentityCount = livinnIdentities.count ?? 0;
  const expectedLivinnIdentityCount = livinnFoodIdentities.length;

  const offIdentityRows = await supabase
    .from("open_food_facts_product_identities")
    .select("gtin", { count: "exact", head: true });
  if (offIdentityRows.error) throw offIdentityRows.error;
  const offIdentityCount = offIdentityRows.count ?? 0;
  const expectedOffIdentityCount = offIdentities.length;
  const cspExpected = cspReport as { connected: boolean; records: number; identities: number };
  const cspPrices = await supabase.from("csp_food_price_records").select("gtin", { count: "exact", head: true });
  if (cspPrices.error) throw cspPrices.error;
  const cspIdentities = await supabase.from("csp_product_identities").select("gtin", { count: "exact", head: true });
  if (cspIdentities.error) throw cspIdentities.error;

  const summary = {
    expected: BARBORA_RATED_PRODUCT_COUNT,
    currentCount,
    completeCount,
    versionCount,
    dueForSilentRevalidation: staleCount,
    expectedLivinnIdentityCount,
    livinnIdentityCount,
    expectedOffIdentityCount,
    offIdentityCount,
    cspConnected: cspExpected.connected,
    expectedCspPriceCount: cspExpected.records,
    cspPriceCount: cspPrices.count ?? 0,
    expectedCspIdentityCount: cspExpected.identities,
    cspIdentityCount: cspIdentities.count ?? 0
  };
  console.log(JSON.stringify(summary, null, 2));

  if (currentCount !== BARBORA_RATED_PRODUCT_COUNT) {
    throw new Error(`Expected ${BARBORA_RATED_PRODUCT_COUNT} current Barbora SKUs, found ${currentCount}`);
  }
  if (completeCount !== BARBORA_RATED_PRODUCT_COUNT) {
    throw new Error(`Expected every Barbora SKU to have protein and total sugar, found ${completeCount}`);
  }
  if (versionCount < BARBORA_RATED_PRODUCT_COUNT) {
    throw new Error(`Expected at least ${BARBORA_RATED_PRODUCT_COUNT} Barbora history rows, found ${versionCount}`);
  }
  if (livinnIdentityCount !== expectedLivinnIdentityCount) {
    throw new Error(`Expected ${expectedLivinnIdentityCount} Livinn food identities, found ${livinnIdentityCount}`);
  }
  if (offIdentityCount !== expectedOffIdentityCount) {
    throw new Error(`Expected ${expectedOffIdentityCount} OFF identity-only rows, found ${offIdentityCount}`);
  }
  if ((cspPrices.count ?? 0) !== cspExpected.records || (cspIdentities.count ?? 0) !== cspExpected.identities) {
    throw new Error("CSP database layer does not match the generated import report");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
