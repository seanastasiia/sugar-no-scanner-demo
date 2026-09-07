import { createClient } from "@supabase/supabase-js";
import cspIdentities from "../data/csp-food-identities.generated.json";
import report from "../data/csp-import-report.generated.json";
import cspPrices from "../data/csp-price-records.generated.json";
import type { CspPriceRecord } from "../src/server/csp-catalog";
import type { ExternalCatalogIdentity } from "../src/server/external-catalog-types";

const summary = report as { connected: boolean; sourceSha256?: string; importedAt?: string; records: number; identities: number };
if (!summary.connected) {
  console.log(JSON.stringify({ connected: false, records: 0, identities: 0, action: "none" }));
  process.exit(0);
}
if (!summary.sourceSha256 || !summary.importedAt || summary.records !== cspPrices.length || summary.identities !== cspIdentities.length) {
  throw new Error("CSP generated files do not reconcile with their import report");
}
const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const supabase = createClient(url, key, { auth: { persistSession: false } });
const batchSize = 500;
const priceRows = (cspPrices as CspPriceRecord[]).map((row) => ({
  price_date: row.date,
  retailer: row.retailer,
  gtin: row.gtin,
  source_gtin: row.sourceGtin,
  item_name: row.itemName,
  base_price_package: row.basePricePackage,
  base_price_unit: row.basePriceUnit,
  discount_price: row.discountPrice,
  quantity: row.quantity,
  unit: row.unit,
  store_type: row.storeType,
  availability: row.availability,
  manufacturer: row.manufacturer,
  manufacturer_country: row.manufacturerCountry,
  url: row.url,
  hierarchy: row.hierarchy,
  description: row.description,
  source_sha256: summary.sourceSha256,
  imported_at: summary.importedAt
}));
const identityRows = (cspIdentities as ExternalCatalogIdentity[]).map((row) => ({
  gtin: row.gtin,
  source_product_id: row.sourceProductId,
  title: row.title,
  aliases: row.aliases,
  manufacturer: row.brand,
  pack_size: row.packSize,
  category: row.category,
  source_url: row.url,
  checked_at: row.checkedAt,
  permitted_purpose: "free_food_price_comparison"
}));
for (let index = 0; index < priceRows.length; index += batchSize) {
  const { error } = await supabase.from("csp_food_price_records").upsert(priceRows.slice(index, index + batchSize), { onConflict: "price_date,retailer,gtin" });
  if (error) throw error;
}
for (let index = 0; index < identityRows.length; index += batchSize) {
  const { error } = await supabase.from("csp_product_identities").upsert(identityRows.slice(index, index + batchSize), { onConflict: "gtin" });
  if (error) throw error;
}
console.log(JSON.stringify({ connected: true, records: priceRows.length, identities: identityRows.length }));
