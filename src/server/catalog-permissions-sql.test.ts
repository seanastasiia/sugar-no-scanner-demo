// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(`
    create table public.products (id text primary key);
    create table public.product_sources (id text primary key, product_id text references public.products(id));
    alter table public.products enable row level security;
    alter table public.product_sources enable row level security;
  `);
  const migration = await readFile(
    new URL("../../supabase/migrations/202609160001_catalog_service_role_read.sql", import.meta.url),
    "utf8"
  );
  await db.exec(migration);
  await db.exec(migration);
}, 30_000);

afterAll(async () => { await db?.close(); });

describe("managed catalog permissions", () => {
  it("allows the server role to read products and their nested sources", async () => {
    const result = await db.query(`
      select
        has_table_privilege('service_role', 'products', 'select') products_read,
        has_table_privilege('service_role', 'product_sources', 'select') sources_read
    `);
    expect(result.rows[0]).toEqual({ products_read: true, sources_read: true });
  });

  it("keeps both catalog tables private from browser roles", async () => {
    const result = await db.query(`
      select
        has_table_privilege('anon', 'products', 'select') anon_products_read,
        has_table_privilege('authenticated', 'products', 'select') user_products_read,
        has_table_privilege('anon', 'product_sources', 'select') anon_sources_read,
        has_table_privilege('authenticated', 'product_sources', 'select') user_sources_read
    `);
    expect(result.rows[0]).toEqual({
      anon_products_read: false,
      user_products_read: false,
      anon_sources_read: false,
      user_sources_read: false
    });
    expect((await db.query(`
      select count(*) n from pg_class
      where relname in ('products', 'product_sources') and relrowsecurity
    `)).rows[0]).toEqual({ n: 2 });
  });
});
