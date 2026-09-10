// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { it, expect } from "vitest";
it("applies queue migration idempotently and verifies real SQL isolation and lease recovery", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    const migration = await readFile(new URL("../../supabase/migrations/202609100002_shelf_research_queue.sql", import.meta.url), "utf8");
    await db.exec(migration); await db.exec(migration);
    await db.exec(await readFile(new URL("../../supabase/tests/shelf_research_queue.sql", import.meta.url), "utf8"));
    const rows = await db.query("select * from shelf_research_jobs");
    expect(rows.rows).toEqual([]);
  } finally { await db.close(); }
}, 30000);
