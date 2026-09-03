// @vitest-environment node
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ProductRecord } from "@/lib/types";
import { sharedRecordToProduct } from "./shared-web-catalog";
import { verifyWebProductPage, webLookupKey } from "./web-product-evidence";
import { lookup, page, productUrl } from "./__fixtures__/verified-web-product";

let db: PGlite;
const observation = verifyWebProductPage(lookup, page(), productUrl)!;
async function promote(product = observation.product, alias = webLookupKey(lookup)) {
  const hash = createHash("sha256").update(JSON.stringify({ product, alias })).digest("hex");
  const result = await db.query<{ value: { status: string; record?: ProductRecord } }>(
    "select public.promote_shared_web_product($1,$2,$3::jsonb,$4) as value",
    [alias, observation.identityKey, JSON.stringify(product), hash]);
  return result.rows[0].value;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(await readFile(new URL("../../supabase/migrations/202609030001_shared_web_products.sql", import.meta.url), "utf8"));
}, 30_000);
beforeEach(async () => { await db.exec("reset role; truncate shared_web_product_aliases, shared_web_products, shared_web_product_observations;"); });
afterAll(async () => { await db?.close(); });

describe("shared catalog migration on isolated PostgreSQL", () => {
  it("atomically creates a shared card, alias and immutable observation", async () => {
    await db.exec("set role service_role");
    expect((await promote()).status).toBe("accepted");
    const counts = await db.query("select (select count(*) from shared_web_products) products, (select count(*) from shared_web_product_aliases) aliases, (select count(*) from shared_web_product_observations) observations");
    expect(counts.rows[0]).toEqual({ products: 1, aliases: 1, observations: 1 });
  });
  it("is idempotent for repeat scans and concurrent same-product requests", async () => {
    await Promise.all([promote(), promote(), promote()]);
    expect((await db.query("select count(*) n from shared_web_products")).rows[0]).toEqual({ n: 1 });
    expect((await db.query("select count(*) n from shared_web_product_observations")).rows[0]).toEqual({ n: 1 });
  });
  it("adds a proven language alias without duplicating the product", async () => {
    await promote();
    await promote(observation.product, webLookupKey({ ...lookup, name: "Классическое печенье", barcode: "4006381333931" }));
    expect((await db.query("select count(*) n from shared_web_products")).rows[0]).toEqual({ n: 1 });
    expect((await db.query("select count(*) n from shared_web_product_aliases")).rows[0]).toEqual({ n: 2 });
  });
  it("preserves unknowns, accepts verified zero, and never erases known values with missing data", async () => {
    const first = structuredClone(observation.product);
    first.nutrientsPer100g.proteinG = null;
    expect((await promote(first)).record?.nutrientsPer100g.proteinG).toBeNull();
    const second = structuredClone(first);
    second.nutrientsPer100g.proteinG = 0;
    const result = await promote(second);
    expect(result.record?.nutrientsPer100g.proteinG).toBe(0);
    expect((await promote(first)).record?.nutrientsPer100g.proteinG).toBe(0);
    expect(sharedRecordToProduct(result.record)?.nutrientsPer100g.fiberG).toBeNull();
  });
  it("quarantines a changed value and cannot heal it automatically on a later scan", async () => {
    await promote();
    const changed = structuredClone(observation.product);
    changed.nutrientsPer100g.proteinG = 10;
    const result = await promote(changed);
    expect(result.record?.nutrientsPer100g.proteinG).toBeNull();
    expect(result.record?.nutrientsPer100g.totalSugarG).toBe(24);
    expect(sharedRecordToProduct(result.record)?.matchScore).toBeNull();
    expect((await promote()).record?.nutrientsPer100g.proteinG).toBeNull();
    expect((await db.query("select decision from shared_web_product_observations where decision='field_conflict'")).rows).toHaveLength(1);
  });
  it("invalidates all nutrition when the 100g/100ml basis conflicts", async () => {
    await promote();
    const changed = { ...observation.product, nutritionBasis: "100ml" as const };
    const result = await promote(changed);
    expect(sharedRecordToProduct(result.record)?.ratingStatus).toBe("identity_only");
    expect(result.record?.nutrientsPer100g.totalSugarG).toBeNull();
  });

  it("cannot assemble an inconsistent table from individually partial observations", async () => {
    const first = structuredClone(observation.product);
    first.nutrientsPer100g.totalSugarG = null;
    first.nutrientsPer100g.carbohydrateG = 20;
    await promote(first);
    const second = structuredClone(observation.product);
    second.nutrientsPer100g.carbohydrateG = null;
    const result = await promote(second);
    expect(result.record?.nutrientsPer100g.totalSugarG).toBeNull();
    expect(sharedRecordToProduct(result.record)?.ratingStatus).toBe("identity_only");
  });
  it("blocks an ambiguous alias instead of reassigning it to another product", async () => {
    await promote();
    const changed = { ...observation.product, id: "web:shared:" + "b".repeat(24) };
    expect((await promote(changed)).status).toBe("conflict");
    expect((await db.query("select blocked, product_id from shared_web_product_aliases")).rows[0]).toEqual({ blocked: true, product_id: observation.product.id });
    expect((await promote()).status).toBe("conflict");
  });
  it("denies browser roles writes, reads and the promotion function", async () => {
    const result = await db.query("select has_table_privilege('anon', 'shared_web_products', 'select') anon_read, has_table_privilege('authenticated', 'shared_web_products', 'insert') user_write, has_function_privilege('anon', 'promote_shared_web_product(text,text,jsonb,text)', 'execute') anon_promote, has_table_privilege('service_role', 'shared_web_product_observations', 'update') history_update");
    expect(result.rows[0]).toEqual({ anon_read: false, user_write: false, anon_promote: false, history_update: false });
    expect((await db.query("select count(*) n from pg_class where relname in ('shared_web_products','shared_web_product_aliases','shared_web_product_observations') and relrowsecurity")).rows[0]).toEqual({ n: 3 });
  });
});
