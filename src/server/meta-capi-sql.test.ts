// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
let db: PGlite;
const now = Math.floor(Date.now() / 1000);
const attempt = "11111111-1111-4111-8111-111111111111";
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  const sql = await readFile(new URL("../../supabase/migrations/202609100001_scanner_meta_purchases.sql", import.meta.url), "utf8");
  await db.exec(sql); await db.exec(sql);
}, 30000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec("reset role; truncate scanner_meta_purchases;");
  await db.query("insert into scanner_meta_purchases(checkout_id,event_id,access_token_hash,consent,context) values ('cs_qa','purchase_qa',$1,true,$2)",
    ["a".repeat(64), JSON.stringify({ client_user_agent: "QA" })]);
});
async function claim(time = now) {
  const result = await db.query<{ result: { state: string; event_time?: number } }>("select claim_scanner_meta_purchase('cs_qa',$1,$2) as result", [time, attempt]);
  return result.rows[0].result;
}
it("leases one sender and preserves event time across a retry", async () => {
  expect(await claim()).toMatchObject({ state: "claimed", event_time: now });
  expect(await claim()).toEqual({ state: "busy" });
  await db.exec("update scanner_meta_purchases set lease_until=null");
  expect(await claim(now + 10)).toMatchObject({ state: "claimed", event_time: now });
});
it("never reclaims an acknowledged event", async () => {
  await db.exec("update scanner_meta_purchases set delivered_at=now(),context=null");
  expect(await claim()).toEqual({ state: "already_delivered" });
});
it("honors revoked consent and expires abandoned matching data", async () => {
  await db.exec("update scanner_meta_purchases set consent=false,context=null");
  expect(await claim()).toEqual({ state: "no_consent" });
  await db.exec("update scanner_meta_purchases set consent=true,context='{}',created_at=now()-interval '8 days'");
  expect(await claim()).toEqual({ state: "no_consent" });
  const row = await db.query<{ context: unknown }>("select context from scanner_meta_purchases");
  expect(row.rows[0].context).toBeNull();
});
it("rejects stale or future event timestamps", async () => {
  expect(await claim(now - 8 * 86400)).toEqual({ state: "expired" });
  expect(await claim(now + 3600)).toEqual({ state: "expired" });
});
it("does not expose ledger or claim API to browser roles", async () => {
  await db.exec("set role anon");
  await expect(db.query("select * from scanner_meta_purchases")).rejects.toThrow(/permission denied/);
  await expect(claim()).rejects.toThrow(/permission denied/);
});
