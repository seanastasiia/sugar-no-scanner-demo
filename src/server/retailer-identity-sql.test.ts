// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec("create table public.catalog_sources (id text primary key);");
  await db.exec("create table public.retailer_catalog_products (id text primary key);");
  await db.exec("insert into public.catalog_sources(id) values ('rimi_lv'), ('lidl_lv'), ('livinn_lt');");
  await db.exec(await readFile(new URL("../../supabase/migrations/202609020001_livinn_multilingual_catalog.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../../supabase/migrations/202609090003_retailer_identity_sources.sql", import.meta.url), "utf8"));
}, 30_000);

afterAll(async () => { await db?.close(); });
beforeEach(async () => { await db.exec("reset role; truncate retailer_catalog_food_identities;"); });

async function insert(source: string, retailer: string) {
  return db.query(
    `insert into retailer_catalog_food_identities
      (source_id, source_product_id, retailer, url, title, brand, sku, category, checked_at)
     values ($1, $2, $3, 'https://example.com/product', 'Food', 'Brand', $2, 'Food', '2026-09-09T00:00:00Z')`,
    [source, `${source}-sku`, retailer]
  );
}

describe("retailer identity source migration", () => {
  it.each([
    ["rimi_lv", "Rimi"],
    ["lidl_lv", "Lidl"],
    ["livinn_lt", "Livin"]
  ])("accepts %s identities", async (source, retailer) => {
    await expect(insert(source, retailer)).resolves.toBeDefined();
  });

  it("rejects an unsupported retailer label", async () => {
    await expect(insert("rimi_lv", "Other")).rejects.toThrow();
  });

  it("rejects a valid retailer attached to the wrong source", async () => {
    await expect(insert("rimi_lv", "Lidl")).rejects.toThrow();
  });

  it("keeps browser roles outside the private identity table", async () => {
    const privileges = await db.query("select has_table_privilege('anon','retailer_catalog_food_identities','select') anon_read, has_table_privilege('authenticated','retailer_catalog_food_identities','insert') user_write");
    expect(privileges.rows[0]).toEqual({ anon_read: false, user_write: false });
  });
});
