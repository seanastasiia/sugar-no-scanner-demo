import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ShelfEvidence } from "../lib/personal-shelf-rank";

const root = process.cwd(), dirs: string[] = [];
const staging = ".catalog-sync/expansion-2026-09-04";
const evidence: ShelfEvidence = { productId: "off:4006381333931", gtin: "4006381333931", source: "open_food_facts",
  sourceUrl: "https://world.openfoodfacts.org/product/4006381333931", checkedAt: "2026-09-04T13:00:00.000Z",
  category: "Chips", nutritionBasis: "100g", ingredientsText: "Potatoes, salt", ingredientsLanguage: "en",
  energyKcal: 400, proteinG: 4, totalSugarG: 2, saltG: .5, saturatedFatG: 1, fiberG: null };
const file = "data/personal-shelf-off-evidence.generated.json";
const other = { ...evidence, productId: "off:3017620422003", gtin: "3017620422003", sourceUrl: "https://world.openfoodfacts.org/product/3017620422003" };
function setup(current: ShelfEvidence[]) {
  const dir = mkdtempSync(join(tmpdir(), "sugar-off-followup-")); dirs.push(dir);
  mkdirSync(join(dir, "data")); mkdirSync(join(dir, staging), { recursive: true });
  writeFileSync(join(dir, file), JSON.stringify(current));
  writeFileSync(join(dir, staging, "off-followup-baseline.json"), JSON.stringify({ ids: [evidence.productId], prior: [] }));
  writeFileSync(join(dir, staging, "off-followup-checkpoint.json"), JSON.stringify({ observations: [evidence], attempts: [{ id: evidence.productId, ok: true }], sourceCooldowns: {} }));
  return dir;
}
function run(dir: string) {
  return execFileSync(process.execPath, ["--import", resolve(root, "node_modules/tsx/dist/loader.mjs"), resolve(root, "scripts/follow-up-off-evidence.ts"), "promote"], {
    cwd: dir, encoding: "utf8", timeout: 15000, env: { ...process.env, TSX_TSCONFIG_PATH: resolve(root, "tsconfig.json") }, stdio: ["ignore", "pipe", "pipe"]
  });
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
describe("bounded OFF follow-up promotion", () => {
  it("preserves concurrently appended other IDs and is idempotent for the same observation", () => {
    const dir = setup([other]);
    run(dir);
    const first = readFileSync(join(dir, file), "utf8");
    expect(JSON.parse(first)).toContainEqual(other);
    expect(JSON.parse(first)).toContainEqual(evidence);
    expect(JSON.parse(first)).toHaveLength(2);
    run(dir);
    expect(readFileSync(join(dir, file), "utf8")).toBe(first);
  });
  it("refuses a concurrently changed target instead of overwriting it", () => {
    const changed = { ...evidence, totalSugarG: 3 };
    const dir = setup([changed]);
    expect(() => run(dir)).toThrow();
    expect(JSON.parse(readFileSync(join(dir, file), "utf8"))).toEqual([changed]);
  });
});
