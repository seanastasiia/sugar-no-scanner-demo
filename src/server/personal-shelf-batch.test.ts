import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = process.cwd();
const temporary: string[] = [];
function setup(ids: string[] = ["barbora:qa-one"]) {
  const dir = mkdtempSync(join(tmpdir(), "sugar-shelf-batch-"));
  temporary.push(dir);
  mkdirSync(join(dir, "data"));
  mkdirSync(join(dir, ".catalog-sync"));
  for (const name of ["personal-shelf-evidence", "personal-shelf-off-evidence", "rimi-catalog", "livinn-food-index", "open-food-facts-lv"]) {
    writeFileSync(join(dir, `data/${name}.generated.json`), "[]\n");
  }
  writeFileSync(join(dir, "data/barbora-nutrition-index.generated.json"), JSON.stringify([
    { slug: "qa-one", category: "Chips", isAdult: false }, { slug: "qa-two", category: "Chips", isAdult: false }
  ]));
  writeFileSync(join(dir, "ids.json"), JSON.stringify(ids));
  return dir;
}
function run(dir: string, mode = "success", apply = true, extra: Record<string, string> = {}) {
  const script = `
    globalThis.fetch = async (url) => {
      console.log("MOCK_FETCH " + new URL(url).pathname);
      if (${JSON.stringify(mode)} === "forbidden") return new Response("denied", {status:403});
      if (${JSON.stringify(mode)} === "limited") return new Response("wait", {status:429,headers:{"retry-after":"120"}});
      if (${JSON.stringify(mode)} === "wrong-id") return new Response('window.product = {"Url":"other","title":"QA","price":1};');
      const product = {Url:new URL(url).pathname.split("/").pop(),title:"QA",price:1,category_name_full_path:"Chips",ingredients:"Kartupeļi, eļļa, sāls",nutrients:[]};
      return new Response("window.product = " + JSON.stringify(product) + ";");
    };
    await import(${JSON.stringify(resolve(root, "scripts/sync-personal-shelf-batch.ts"))});
  `;
  return execFileSync(process.execPath, ["--import", resolve(root, "node_modules/tsx/dist/loader.mjs"), "--input-type=module", "-e", script, "--", ...(apply ? ["--apply"] : [])], {
    cwd: dir, encoding: "utf8", timeout: 15000,
    env: { ...process.env, TSX_TSCONFIG_PATH: resolve(root, "tsconfig.json"),
      SHELF_BATCH_IDS_FILE: "ids.json", SHELF_BATCH_CHECKPOINT: ".catalog-sync/test-checkpoint.json",
      SHELF_BATCH_RETAILER_OUTPUT: ".catalog-sync/retailer.json", SHELF_BATCH_OFF_OUTPUT: ".catalog-sync/off.json",
      SHELF_BATCH_REPORT: ".catalog-sync/report.json", SHELF_BATCH_RESUME_ONLY: "true", ...extra },
    stdio: ["ignore", "pipe", "pipe"]
  });
}
const checkpoint = (dir: string) => JSON.parse(readFileSync(join(dir, ".catalog-sync/test-checkpoint.json"), "utf8"));
afterEach(() => { for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("bounded Personal Shelf source batches", () => {
  it("plans only explicit IDs without a network request", () => {
    const out = run(setup(), "success", false);
    expect(out).toContain('"candidates":1');
    expect(out).toContain('"planned":1');
    expect(out).not.toContain("MOCK_FETCH");
  });
  it("rejects duplicate and unknown IDs before any fetch", () => {
    for (const ids of [["barbora:qa-one", "barbora:qa-one"], ["barbora:missing"]]) {
      expect(() => run(setup(ids))).toThrow();
    }
  });
  it("writes candidates separately, keeps nulls, and does not repeat a completed request", () => {
    const dir = setup();
    expect(run(dir)).toContain("MOCK_FETCH /produkti/qa-one");
    const saved = checkpoint(dir);
    expect(saved.attempts).toHaveLength(1);
    expect(saved.observations[0]).toMatchObject({ productId: "barbora:qa-one", totalSugarG: null, fiberG: null });
    expect(readFileSync(join(dir, "data/personal-shelf-evidence.generated.json"), "utf8")).toBe("[]\n");
    expect(readFileSync(join(dir, "data/personal-shelf-off-evidence.generated.json"), "utf8")).toBe("[]\n");
    const again = run(dir);
    expect(again).toContain('"planned":0');
    expect(again).not.toContain("MOCK_FETCH");
    expect(checkpoint(dir).observations).toEqual(saved.observations);
  }, 20000);
  it.each(["limited", "forbidden"])("stops a %s source and persists the retry boundary", (mode) => {
    const dir = setup(["barbora:qa-one", "barbora:qa-two"]);
    const before = Date.now();
    const output = run(dir, mode);
    expect(output.match(/MOCK_FETCH/g)).toHaveLength(1);
    const saved = checkpoint(dir);
    expect(saved.attempts).toHaveLength(1);
    expect(saved.observations).toEqual([]);
    expect(Date.parse(saved.sourceCooldowns.barbora_lv)).toBeGreaterThanOrEqual(before + (mode === "limited" ? 120000 : 21600000));
    expect(run(dir, "success", false)).toContain('"planned":0');
  });
  it("rejects a redirected or changed exact SKU", () => {
    const dir = setup();
    run(dir, "wrong-id");
    expect(checkpoint(dir).observations).toEqual([]);
    expect(checkpoint(dir).attempts[0]).toMatchObject({ ok: false, error: "Exact SKU changed" });
  });
});
