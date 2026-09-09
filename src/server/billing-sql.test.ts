// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(await readFile(new URL("../../supabase/migrations/202609070001_scanner_wtp_billing.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../../supabase/migrations/202609070002_scanner_wtp_service_role_grants.sql", import.meta.url), "utf8"));
}, 30_000);

afterAll(async () => { await db?.close(); });

beforeEach(async () => {
  await db.exec("reset role; truncate scanner_restore_tokens, scanner_access_tokens, scanner_entitlements cascade;");
});

async function seedEntitlement(status = "active", expiresAt = "2026-09-14T12:00:00Z") {
  const result = await db.query<{ id: string }>(`
    insert into scanner_entitlements (
      stripe_checkout_session_id, status, starts_at, expires_at
    ) values ('cs_test_paid', $1, '2026-09-07T12:00:00Z', $2)
    returning id
  `, [status, expiresAt]);
  return result.rows[0].id;
}

describe("scanner willingness-to-pay migration", () => {
  it("claims a valid restore token once and attaches the new browser token", async () => {
    const entitlementId = await seedEntitlement();
    await db.query(`
      insert into scanner_restore_tokens (token_hash, entitlement_id, expires_at)
      values ($1, $2, '2026-09-14T12:00:00Z')
    `, ["a".repeat(64), entitlementId]);

    const first = await db.query<{ expires_at: Date }>(
      "select * from claim_scanner_restore_token($1, $2)",
      ["a".repeat(64), "b".repeat(64)]
    );
    const second = await db.query(
      "select * from claim_scanner_restore_token($1, $2)",
      ["a".repeat(64), "c".repeat(64)]
    );

    expect(first.rows).toHaveLength(1);
    expect(second.rows).toHaveLength(0);
    expect((await db.query("select token_hash from scanner_access_tokens")).rows).toEqual([
      { token_hash: "b".repeat(64) }
    ]);
  });

  it("does not restore revoked or expired access", async () => {
    const entitlementId = await seedEntitlement("revoked");
    await db.query(`
      insert into scanner_restore_tokens (token_hash, entitlement_id, expires_at)
      values ($1, $2, '2026-09-14T12:00:00Z')
    `, ["d".repeat(64), entitlementId]);
    expect((await db.query(
      "select * from claim_scanner_restore_token($1, $2)",
      ["d".repeat(64), "e".repeat(64)]
    )).rows).toHaveLength(0);
  });

  it("keeps billing tables and restore RPC unavailable to browser roles", async () => {
    const privileges = await db.query(`
      select
        has_table_privilege('anon', 'scanner_entitlements', 'select') anon_read,
        has_table_privilege('authenticated', 'scanner_access_tokens', 'insert') user_write,
        has_function_privilege('anon', 'claim_scanner_restore_token(text,text)', 'execute') anon_rpc
    `);
    expect(privileges.rows[0]).toEqual({ anon_read: false, user_write: false, anon_rpc: false });
    expect((await db.query(`
      select count(*) n from pg_class
      where relname in ('scanner_entitlements', 'scanner_access_tokens', 'scanner_restore_tokens')
        and relrowsecurity
    `)).rows[0]).toEqual({ n: 3 });
  });

  it("allows only the server role to operate the billing tables", async () => {
    const privileges = await db.query(`
      select
        has_table_privilege('service_role', 'scanner_entitlements', 'select,insert,update') entitlements,
        has_table_privilege('service_role', 'scanner_access_tokens', 'select,insert,update') access_tokens,
        has_table_privilege('service_role', 'scanner_restore_tokens', 'select,insert,update') restore_tokens
    `);
    expect(privileges.rows[0]).toEqual({ entitlements: true, access_tokens: true, restore_tokens: true });
  });
});
