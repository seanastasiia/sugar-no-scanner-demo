// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { it, expect } from "vitest";

it("counts actual displays and ordered real scans, excludes QA, samples and unrelated scan sessions", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table scan_events(session_id text,event_name text,source text,metadata jsonb,created_at timestamptz);`);
    const insert = async (visit: string, name: string, minute: number, source = "camera", scan = visit, extra = {}) => {
      await db.query(`insert into scan_events values ($1,$2,$3,$4,$5)`, [scan, name, source,
        JSON.stringify({ onboardingVersion: visit === "ok" ? 11 : 10, browserSessionId: visit, step: 1, path: "in_store", utm_campaign: "shelf_lv_pilot_02", ...extra }),
        `2026-09-24T09:${String(minute).padStart(2,"0")}:00Z`]);
    };
    for (const visit of ["ok", "qa", "sample", "returning", "out-of-order", "different-scan", "direct"]) {
      const extra = visit === "qa" ? { trafficType: "qa" } : visit === "direct" ? { entryCampaign: "" } : {};
      await insert(visit, "app_opened", 0, "camera", visit, extra);
      if (visit === "returning") continue;
      await insert(visit, "onboarding_step_viewed", 1, "camera", visit, extra);
      await insert(visit, "onboarding_path_selected", 2, "camera", visit, extra);
      await insert(visit, "scan_started", visit === "out-of-order" ? 0 : 3, visit === "sample" ? "sample-shelf" : "upload", `${visit}-scan`, extra);
      await insert(visit, "scan_completed", 4, visit === "sample" ? "sample-shelf" : "upload", visit === "different-scan" ? "other" : `${visit}-scan`, extra);
    }
    const sql = (await readFile(new URL("../../scripts/analytics/scanner-daily-funnel.sql", import.meta.url), "utf8"))
      .replace("(current_timestamp at time zone 'Europe/Riga')::date - 1", "date '2026-09-24'");
    const { rows } = await db.query<{ scope: string }>(sql);
    for (const row of rows) expect(row).toMatchObject(row.scope === "all" ? {
      opened_visits: 6, onboarding_shown: 5, chose_real_scan: 5,
      started_real_scan_after_choice: 3, completed_real_scan_after_choice: 2,
      shown_to_real_result_pct: "40.00"
    } : {
      opened_visits: 5, onboarding_shown: 4, chose_real_scan: 4,
      started_real_scan_after_choice: 2, completed_real_scan_after_choice: 1,
      shown_to_real_result_pct: "25.00"
    });
    expect(rows).toHaveLength(2);
    const version11 = await db.query(sql.replace("null::text as onboarding_version", "'11'::text as onboarding_version"));
    expect(version11.rows).toHaveLength(2);
    for (const row of version11.rows) expect(row).toMatchObject({
      opened_visits: 1, onboarding_shown: 1, started_real_scan_after_choice: 1,
      completed_real_scan_after_choice: 1, shown_to_real_result_pct: "100.00"
    });
  } finally { await db.close(); }
}, 30_000);
