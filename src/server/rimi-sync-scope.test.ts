// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Rimi import category coverage", () => {
  it.each([
    "vegana-un-vegetara-partika",
    "veganiem-un-vegetariesiem,missing-food-section"
  ])("rejects absent configured categories before modifying snapshots: %s", (categories) => {
    const directory = mkdtempSync(path.join(tmpdir(), "rimi-scope-"));
    const output = path.join(directory, "products.json");
    writeFileSync(output, '[{"existing":"preserve"}]');
    const script = `
      globalThis.fetch = async (url) => new Response(String(url).endsWith("sitemap.xml")
        ? '<sitemapindex><sitemap><loc>https://www.rimi.lv/e-veikals/Product_lv_1.xml</loc></sitemap></sitemapindex>'
        : '<urlset><url><loc>https://www.rimi.lv/e-veikals/lv/produkti/veganiem-un-vegetariesiem/deserti/example/p/123</loc></url></urlset>');
      await import('./scripts/sync-retailer-catalog.ts');
    `;
    try {
      let failure: { status?: number; stderr?: Buffer } | undefined;
      try {
        execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
          cwd: process.cwd(),
          env: { ...process.env, RETAILER_SYNC_SOURCE: "rimi", RETAILER_SYNC_RIMI_CATEGORIES: categories,
            RETAILER_SYNC_OUTPUT: output, RETAILER_SYNC_REPORT: path.join(directory, "report.json"),
            RETAILER_SYNC_PROGRESS: path.join(directory, "progress.json"),
            RETAILER_SYNC_IDENTITY_OUTPUT: path.join(directory, "identities.json") },
          stdio: "pipe", timeout: 10_000
        });
      } catch (error) {
        failure = error as typeof failure;
      }
      expect(failure?.status).toBe(1);
      expect(String(failure?.stderr)).toContain("Rimi configured categories absent from sitemap");
      expect(readFileSync(output, "utf8")).toBe('[{"existing":"preserve"}]');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
