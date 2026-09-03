// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { shelfFixture } from "../../tests/fixtures/personal-shelf";

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(await readFile(new URL("../../supabase/migrations/202609030002_personal_shelf_evidence.sql", import.meta.url), "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await db.exec("reset role; truncate retailer_shelf_evidence, open_food_facts_shelf_evidence;"); });
const write = async (e = shelfFixture("barbora:qa", { fiberG: null }).shelfEvidence!) =>
  (await db.query<{ status: string }>("select public.upsert_personal_shelf_evidence($1::jsonb) status", [JSON.stringify(e)])).rows[0].status;
describe("isolated shelf evidence migration", () => {
  it("preserves null and zero, supports Rimi, and is replay-safe", async () => {
    const e = shelfFixture("rimi_lv:100", { source: "rimi_lv", sourceUrl: "https://www.rimi.lv/e-veikals/lv/produkti/chips/p/100", fiberG: null, saltG: 0 }).shelfEvidence!;
    expect(await write(e)).toBe("written");
    expect(await write(e)).toBe("not_newer");
    const result = await db.query<{ evidence: typeof e }>("select evidence from retailer_shelf_evidence");
    expect(result.rows[0].evidence).toEqual(e);
  });
  it("does not replace a newer observation with an older batch", async () => {
    const e = shelfFixture("barbora:qa").shelfEvidence!;
    await write({ ...e, checkedAt: "2026-09-04T12:00:00Z", fiberG: null });
    expect(await write(e)).toBe("not_newer");
    expect((await db.query<{ evidence: typeof e }>("select evidence from retailer_shelf_evidence")).rows[0].evidence.fiberG).toBeNull();
  });
  it("isolates the ODbL layer and rejects a mismatched source identity", async () => {
    const e = shelfFixture("off:1234567890123", { source: "open_food_facts", sourceUrl: "https://world.openfoodfacts.org/product/1234567890123" }).shelfEvidence!;
    await write(e);
    expect((await db.query("select count(*) n from retailer_shelf_evidence")).rows[0]).toEqual({ n: 0 });
    expect((await db.query("select count(*) n from open_food_facts_shelf_evidence")).rows[0]).toEqual({ n: 1 });
    await expect(write({ ...e, productId: "barbora:qa" })).rejects.toThrow("source and identity conflict");
  });
  it("denies browser access to tables and the ingestion function", async () => {
    const result = await db.query("select has_table_privilege('anon','retailer_shelf_evidence','select') anon_read, has_table_privilege('authenticated','open_food_facts_shelf_evidence','insert') user_write, has_function_privilege('anon','upsert_personal_shelf_evidence(jsonb)','execute') anon_rpc");
    expect(result.rows[0]).toEqual({ anon_read: false, user_write: false, anon_rpc: false });
    expect((await db.query("select count(*) n from pg_class where relname in ('retailer_shelf_evidence','open_food_facts_shelf_evidence') and relrowsecurity")).rows[0]).toEqual({ n: 2 });
  });
});
