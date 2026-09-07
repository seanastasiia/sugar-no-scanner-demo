// @vitest-environment node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;

const gtin = "04006381333931";
const checkedAt = "2026-09-07T12:00:00.000Z";
const record = {
  code: gtin,
  product_name: "Soft Toffee Protein Bar",
  product_name_ru: "Протеиновый батончик мягкая карамель",
  brands: ["NICK'S"],
  quantity: "50 g",
  nutrition_data_per: "100g",
  nutriments: {
    "energy-kcal_100g": 360,
    proteins_100g: 30,
    sugars_100g: 3.2,
    carbohydrates_100g: 18
  }
};

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function promote(input: {
  product?: typeof record;
  observedAt?: string;
  identity?: unknown;
  composition?: unknown;
  targetGtin?: string;
  aliasKey?: string;
} = {}) {
  const product = input.product || record;
  const targetGtin = input.targetGtin || gtin;
  const aliasKey = input.aliasKey === undefined ? `off-v1:${"a".repeat(64)}` : input.aliasKey;
  const identity = input.identity || { gtin: targetGtin, brand: "nicks", packSizeG: 50, nutritionBasis: "100g" };
  const composition = input.composition || { proteinG: 30, totalSugarG: 3.2, carbohydrateG: 18 };
  const version = digest({ gtin: targetGtin, aliasKey, product, identity, composition });
  const result = await db.query<{ value: { status: string } }>(
    "select public.promote_shared_open_food_facts_product($1,$2,$3::jsonb,$4,$5,$6,$7) as value",
    [targetGtin, aliasKey, JSON.stringify(product), input.observedAt || checkedAt, digest(identity), digest(composition), version]
  );
  return result.rows[0].value;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(await readFile(new URL("../../supabase/migrations/202609070001_shared_open_food_facts.sql", import.meta.url), "utf8"));
}, 30_000);

beforeEach(async () => {
  await db.exec("reset role; truncate shared_open_food_facts_observations, shared_open_food_facts_aliases, shared_open_food_facts_products;");
});

afterAll(async () => { await db?.close(); });

describe("shared Open Food Facts migration on isolated PostgreSQL", () => {
  it("creates one attributed ODbL card and one immutable observation", async () => {
    expect(await promote()).toEqual({ status: "accepted" });
    const stored = await db.query("select gtin, record, blocked, attribution, license from shared_open_food_facts_products");
    expect(stored.rows).toEqual([{
      gtin,
      record,
      blocked: false,
      attribution: "Open Food Facts contributors",
      license: "ODbL-1.0"
    }]);
    expect((await db.query("select count(*) n from shared_open_food_facts_observations")).rows[0]).toEqual({ n: 1 });
    expect((await db.query("select count(*) n from shared_open_food_facts_aliases")).rows[0]).toEqual({ n: 1 });
  });

  it("is idempotent and keeps the newest record for the same verified composition", async () => {
    await Promise.all([promote(), promote(), promote()]);
    const newer = { ...record, product_name: "Soft Toffee Protein Bar 50 g" };
    expect(await promote({ product: newer, observedAt: "2026-09-08T12:00:00.000Z" })).toEqual({ status: "accepted" });
    expect(await promote({ observedAt: "2026-09-06T12:00:00.000Z" })).toEqual({ status: "accepted" });
    const stored = await db.query("select record, checked_at from shared_open_food_facts_products");
    expect(stored.rows[0]).toMatchObject({ record: newer });
    expect(new Date((stored.rows[0] as { checked_at: string }).checked_at).toISOString()).toBe("2026-09-08T12:00:00.000Z");
    expect((await db.query("select count(*) n from shared_open_food_facts_products")).rows[0]).toEqual({ n: 1 });
    expect((await db.query("select count(*) n from shared_open_food_facts_observations")).rows[0]).toEqual({ n: 2 });
  });

  it("blocks a contradictory composition permanently without stitching fields", async () => {
    await promote();
    const changed = structuredClone(record);
    changed.nutriments.proteins_100g = 12;
    expect(await promote({ product: changed, composition: { proteinG: 12, totalSugarG: 3.2, carbohydrateG: 18 } })).toEqual({ status: "conflict" });
    expect(await promote()).toEqual({ status: "conflict" });
    const stored = await db.query("select record, blocked from shared_open_food_facts_products");
    expect(stored.rows[0]).toEqual({ record, blocked: true });
    expect((await db.query("select decision from shared_open_food_facts_observations order by decision")).rows).toEqual([
      { decision: "accepted" },
      { decision: "conflict" }
    ]);
  });

  it("rejects a record whose embedded code does not match the target GTIN", async () => {
    await expect(promote({ product: { ...record, code: "00000000000000" } })).rejects.toThrow("invalid shared Open Food Facts observation");
    expect((await db.query("select count(*) n from shared_open_food_facts_products")).rows[0]).toEqual({ n: 0 });
  });

  it("blocks an alias that later points at another GTIN", async () => {
    await promote();
    const otherGtin = "03017620422003";
    expect(await promote({
      targetGtin: otherGtin,
      product: { ...record, code: otherGtin }
    })).toEqual({ status: "conflict" });
    expect((await db.query("select gtin, blocked from shared_open_food_facts_aliases")).rows[0]).toEqual({ gtin, blocked: true });
    expect((await db.query("select count(*) n from shared_open_food_facts_products")).rows[0]).toEqual({ n: 1 });
  });

  it("denies browser roles and protects observation history", async () => {
    const privileges = await db.query("select has_table_privilege('anon', 'shared_open_food_facts_products', 'select') anon_read, has_table_privilege('authenticated', 'shared_open_food_facts_products', 'insert') user_write, has_function_privilege('anon', 'promote_shared_open_food_facts_product(text,text,jsonb,timestamptz,text,text,text)', 'execute') anon_promote, has_table_privilege('service_role', 'shared_open_food_facts_observations', 'update') history_update");
    expect(privileges.rows[0]).toEqual({ anon_read: false, user_write: false, anon_promote: false, history_update: false });
    expect((await db.query("select count(*) n from pg_class where relname in ('shared_open_food_facts_products','shared_open_food_facts_aliases','shared_open_food_facts_observations') and relrowsecurity")).rows[0]).toEqual({ n: 3 });
  });
});
