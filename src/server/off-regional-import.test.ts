import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OffParquetRow } from "./open-food-facts-parquet";

const root = process.cwd(), dirs: string[] = [];
const base: OffParquetRow = { code: "4006381333931", brands: "QA", categories: "Chips", countries_tags: ["en:latvia"], lang: null,
  product_name: [{ lang: "main", text: "QA chips" }], ingredients_text: [{ lang: "main", text: "Potatoes, salt" }],
  quantity: "100 g", product_quantity_unit: "g", nutrition_data_per: "100g",
  nutriments: [{ name: "energy-kcal", "100g": 400 }, { name: "proteins", "100g": 4 }, { name: "sugars", "100g": 2 }] };
const staging = ".catalog-sync/expansion-2026-09-04";
function setup(rows: OffParquetRow[]) {
  const dir = mkdtempSync(join(tmpdir(), "sugar-off-import-")); dirs.push(dir);
  mkdirSync(join(dir, "data")); mkdirSync(join(dir, staging), { recursive: true });
  writeFileSync(join(dir, "data/open-food-facts-lv.generated.json"), '[{"gtin":"3017620422003","title":"Untouched old card"}]\n');
  for (const name of ["open-food-facts-regional", "personal-shelf-off-evidence"]) writeFileSync(join(dir, `data/${name}.generated.json`), "[]\n");
  writeFileSync(join(dir, "data/personal-shelf-evidence.generated.json"), '["untouched retailer"]\n');
  const revision = "a".repeat(40);
  writeFileSync(join(dir, staging, "off-extraction.json"), JSON.stringify({ revision, rows: rows.length, checkedAt: "2026-09-04T13:00:00.000Z", sourceUrl: `https://huggingface.co/datasets/openfoodfacts/product-database/resolve/${revision}/food.parquet` }));
  writeFileSync(join(dir, staging, "off-parquet-rows.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return dir;
}
function run(dir: string, apply = false) {
  return execFileSync(process.execPath, ["--import", resolve(root, "node_modules/tsx/dist/loader.mjs"), resolve(root, "scripts/import-off-regional-parquet.ts"), ...(apply ? ["--apply"] : [])], {
    cwd: dir, encoding: "utf8", timeout: 15000, env: { ...process.env, TSX_TSCONFIG_PATH: resolve(root, "tsconfig.json") }
  });
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
describe("regional OFF snapshot promotion", () => {
  it("plans before writing, appends new IDs once and preserves source layers and unknown language", () => {
    const dir = setup([base, { ...base, code: "3017620422003" }]);
    run(dir);
    const read = (file: string) => readFileSync(join(dir, file), "utf8");
    expect(read("data/open-food-facts-regional.generated.json")).toBe("[]\n");
    run(dir, true);
    const first = read("data/open-food-facts-regional.generated.json");
    const evidence = JSON.parse(read("data/personal-shelf-off-evidence.generated.json"));
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({ ingredientsLanguage: null, fiberG: null });
    run(dir, true);
    expect(read("data/open-food-facts-regional.generated.json")).toBe(first);
    expect(read("data/open-food-facts-lv.generated.json")).toBe('[{"gtin":"3017620422003","title":"Untouched old card"}]\n');
    expect(read("data/personal-shelf-evidence.generated.json")).toBe('["untouched retailer"]\n');
    expect(JSON.parse(read("data/open-food-facts-regional-import-report.generated.json")).added).toBe(1);
  });
  it("quarantines conflicting duplicate GTINs instead of selecting the first or last recipe", () => {
    const dir = setup([base, { ...base, ingredients_text: [{ lang: "main", text: "Sugar, salt" }] }]);
    run(dir, true);
    expect(readFileSync(join(dir, "data/open-food-facts-regional.generated.json"), "utf8")).toBe("[]\n");
    expect(JSON.parse(readFileSync(join(dir, staging, "off-import-report.json"), "utf8")).conflicts).toHaveLength(1);
  });
});
