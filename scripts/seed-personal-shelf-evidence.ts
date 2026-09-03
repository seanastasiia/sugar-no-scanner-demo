import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import type { ShelfEvidence } from "../src/lib/personal-shelf-rank";
import { assessPersonalShelfProduct, shelfScoreBounds } from "../src/lib/personal-shelf-rank";
import type { ExternalCatalogProduct } from "../src/server/external-catalog-types";
import { parseShelfEvidence } from "../src/server/personal-shelf-evidence";

const retailer: ShelfEvidence[] = JSON.parse(await readFile("data/personal-shelf-evidence.generated.json", "utf8"));
const off: ShelfEvidence[] = JSON.parse(await readFile("data/personal-shelf-off-evidence.generated.json", "utf8"));
for (const file of ["data/open-food-facts-lv.generated.json", "data/open-food-facts-regional.generated.json"]) {
  const records: ExternalCatalogProduct[] = JSON.parse(await readFile(file, "utf8"));
  off.push(...records.flatMap((row) => row.shelfEvidence && !off.some((e) => e.productId === row.shelfEvidence!.productId) ? [row.shelfEvidence] : []));
}
const rows = [...retailer, ...off];
if (new Set(rows.map((r) => r.productId)).size !== rows.length) throw new Error("Duplicate evidence identity");
for (const row of rows) {
  if (!parseShelfEvidence(row)) throw new Error(`Invalid exact-source evidence: ${row.productId}`);
}
console.log(JSON.stringify({ mode: process.argv.includes("--apply") ? "apply" : "dry-run", retailer: retailer.length, openFoodFacts: off.length,
  assessed: rows.filter((row) => shelfScoreBounds(assessPersonalShelfProduct({ id: row.productId, gtin: row.gtin, category: row.category, format: "other", shelfEvidence: row }))).length }));
if (!process.argv.includes("--apply")) process.exit(0);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
const db = createClient(url, key, { auth: { persistSession: false } });
for (const [table, values] of [["retailer_shelf_evidence", retailer], ["open_food_facts_shelf_evidence", off]] as const) {
  for (let i = 0; i < values.length; i += 100) {
    const batch = values.slice(i, i + 100).map((evidence) => ({ product_id: evidence.productId, checked_at: evidence.checkedAt, evidence }));
    // Bounded parallel RPCs: each same-ID update is atomic and preserves newer rows.
    for (let offset = 0; offset < batch.length; offset += 5) {
      await Promise.all(batch.slice(offset, offset + 5).map(async (row) => {
        const { error } = await db.rpc("upsert_personal_shelf_evidence", { p_evidence: row.evidence });
        if (error) throw new Error(`Supabase evidence write failed: ${error.code}`);
      }));
    }
    const { data, error: readError } = await db.from(table).select("product_id, evidence").in("product_id", batch.map((r) => r.product_id));
    if (readError || data?.length !== batch.length) throw new Error(`Readback failed for ${table}`);
    for (const row of batch) {
      const saved = data.find((r) => r.product_id === row.product_id)?.evidence as ShelfEvidence;
      if (Date.parse(saved?.checkedAt) > Date.parse(row.evidence.checkedAt)) continue;
      if (Object.keys(row.evidence).some((key) => JSON.stringify(saved?.[key as keyof ShelfEvidence]) !== JSON.stringify(row.evidence[key as keyof ShelfEvidence]))) throw new Error(`Evidence mismatch: ${row.product_id}`);
    }
    console.log(JSON.stringify({ table, verified: Math.min(i + 100, values.length), total: values.length }));
  }
}
console.log("Supabase evidence upsert and readback passed. No rows deleted.");
