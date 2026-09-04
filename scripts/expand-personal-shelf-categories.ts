import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { shelfCategory } from "../src/lib/personal-shelf-rank";
import { rimiShelfCategory } from "../src/server/personal-shelf-parser";

const dir = ".catalog-sync/expansion-2026-09-04";
const json = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, "utf8"));
const mode = process.argv[2] || "plan";
if (mode === "plan") {
  const temp = await mkdtemp(resolve(dir, "prior-model-"));
  try {
    for (const name of ["personal-shelf-rank", "personal-shelf-ingredient-aliases"]) {
      const source = execFileSync("git", ["show", `b4e74534d08adc3a0b4be7f8fbd485f122c9c29a:src/lib/${name}.ts`], { encoding: "utf8" });
      await writeFile(`${temp}/${name}.ts`, source);
    }
    const old = await import(pathToFileURL(`${temp}/personal-shelf-rank.ts`).href);
    const barbora = await json<Array<{slug:string;category:string;isAdult:boolean}>>("data/barbora-nutrition-index.generated.json");
    const items = barbora.filter((r) => !r.isAdult).map((r) => ({ id: `barbora:${r.slug}`, category: r.category }));
    for (const name of ["rimi-catalog", "livinn-food-index"]) {
      const rows = await json<Array<{source:string;sourceProductId:string;category:string;url:string}>>(`data/${name}.generated.json`);
      items.push(...rows.map((r) => ({ id: `${r.source}:${r.sourceProductId}`, category: r.source === "rimi_lv" ? rimiShelfCategory(r.url) : r.category })));
    }
    const reviewed = items.filter((r) => !old.shelfCategory(r.category) && shelfCategory(r.category));
    if (reviewed.length > 500) throw new Error("Category review exceeded the 500-ID bound");
    await writeFile(`${dir}/category-ids.json`, JSON.stringify(reviewed.map((r) => r.id), null, 2) + "\n");
    await writeFile(`${dir}/category-review.json`, JSON.stringify(reviewed.map((r) => ({ ...r, mappedTo: shelfCategory(r.category) })), null, 2) + "\n");
    const existing = await json<{sourceCooldowns?:Record<string,string>}>(".catalog-sync/personal-shelf-batch-v1.json");
    try { await readFile(`${dir}/category-checkpoint.json`); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await writeFile(`${dir}/category-checkpoint.json`, JSON.stringify({ observations: [], attempts: [], sourceCooldowns: existing.sourceCooldowns || {} }));
    }
    console.log(JSON.stringify({ reviewed: reviewed.length, categories: [...new Set(reviewed.map((r) => shelfCategory(r.category)))] }));
  } finally { await rm(temp, { recursive: true, force: true }); }
} else if (mode === "run" || mode === "dry-run") {
  Object.assign(process.env, { SHELF_BATCH_IDS_FILE: `${dir}/category-ids.json`, SHELF_BATCH_CHECKPOINT: `${dir}/category-checkpoint.json`,
    SHELF_BATCH_RETAILER_OUTPUT: `${dir}/category-retailer.json`, SHELF_BATCH_OFF_OUTPUT: `${dir}/category-off.json`,
    SHELF_BATCH_REPORT: `${dir}/category-requests.json`, SHELF_BATCH_RESUME_ONLY: "true" });
  if (mode === "run") process.argv.push("--apply");
  await import("./sync-personal-shelf-batch");
} else if (mode === "promote") {
  type Row = { productId: string };
  const current = await json<Row[]>("data/personal-shelf-evidence.generated.json");
  const candidate = await json<Row[]>(`${dir}/category-retailer.json`);
  const reviewed = new Set(await json<string[]>(`${dir}/category-ids.json`));
  const before = new Map(current.map((r) => [r.productId, r]));
  const after = new Map(candidate.map((r) => [r.productId, r]));
  if (candidate.length !== after.size) throw new Error("Duplicate candidate evidence");
  for (const row of current) if (JSON.stringify(after.get(row.productId)) !== JSON.stringify(row)) throw new Error(`Existing evidence changed: ${row.productId}`);
  const added = candidate.filter((r) => !before.has(r.productId));
  if (added.some((r) => !reviewed.has(r.productId))) throw new Error("Unreviewed category evidence");
  await writeFile("data/personal-shelf-evidence.generated.json", JSON.stringify(candidate, null, 2) + "\n");
  console.log(JSON.stringify({ previous: current.length, added: added.length, total: candidate.length }));
} else throw new Error("Use plan, dry-run, run or promote");
