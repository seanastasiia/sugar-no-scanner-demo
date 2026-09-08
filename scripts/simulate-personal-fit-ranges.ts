import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import { assessPersonalShelfProduct, shelfScoreBounds, type ShelfEvidence } from "../src/lib/personal-shelf-rank";
import { shelfEvidencePer100g } from "../src/lib/personal-shelf-basis-conversion";

const json = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, "utf8"));
const evidence = [...await json<ShelfEvidence[]>("data/personal-shelf-evidence.generated.json"), ...await json<ShelfEvidence[]>("data/personal-shelf-off-evidence.generated.json")];
const assess = (row: ShelfEvidence) => assessPersonalShelfProduct({ id: row.productId, gtin: row.gtin, category: row.category, format: "other", shelfEvidence: row });
const band = (score: number) => score >= 75 ? "great" : score >= 50 ? "moderate" : "low";
type Simulation = { id: string; missing: string; min: number; max: number; stableBand: string | null; scenarios: number };

function candidatesFor(row: ShelfEvidence, missing: string): ShelfEvidence[] {
  const copies = (...changes: Partial<ShelfEvidence>[]) => changes.map((change) => ({ ...row, ...change }));
  const comparable = shelfEvidencePer100g(row);
  if (!comparable) return [];
  const factor = row.nutritionBasis === "100ml" ? row.basisConversion!.factor : 1;
  const sourceValue = (per100g: number) => per100g / factor;
  if (missing === "sugar") {
    const max = typeof comparable.carbohydrateG === "number" ? Math.min(100, comparable.carbohydrateG + 1) : 100;
    return copies({ totalSugarG: sourceValue(0.000001) }, { totalSugarG: sourceValue(max) });
  }
  if (missing === "salt") return copies({ saltG: sourceValue(0.000001) }, { saltG: sourceValue(100) });
  if (missing === "saturated fat") {
    const max = typeof comparable.fatG === "number" ? Math.min(100, comparable.fatG + 1) : 100;
    return copies({ saturatedFatG: sourceValue(0.000001) }, { saturatedFatG: sourceValue(max) });
  }
  if (missing === "protein") {
    const macroMax = 101 - (comparable.carbohydrateG || 0) - (comparable.fatG || 0);
    const energyMax = typeof comparable.energyKcal === "number" ? comparable.energyKcal * 1.15 / 4 : 100;
    return copies({ proteinG: 0 }, { proteinG: sourceValue(Math.max(0, Math.min(100, macroMax, energyMax))) });
  }
  if (missing === "energy") {
    const min = Math.max(0.000001, (comparable.proteinG || 0) * 4 / 1.15);
    return copies({ energyKcal: sourceValue(min) }, { energyKcal: sourceValue(900) });
  }
  if (missing === "recognized first ingredient" || missing === "ingredient list in a supported language") {
    return copies({ ingredientsText: "Sugar", ingredientsLanguage: "en" }, { ingredientsText: "Starch", ingredientsLanguage: "en" },
      { ingredientsText: "Wholegrain oats", ingredientsLanguage: "en" });
  }
  return [];
}

const simulations: Simulation[] = [];
for (const row of evidence) {
  const current = assess(row);
  if (current.status === "provisional" && current.scoreRange) {
    simulations.push({ id: row.productId, missing: "fiber", min: current.scoreRange.min, max: current.scoreRange.max,
      stableBand: band(current.scoreRange.min) === band(current.scoreRange.max) ? band(current.scoreRange.min) : null, scenarios: 2 });
    continue;
  }
  if (current.status !== "missing_data" || current.missing.length !== 1) continue;
  const bounds = candidatesFor(row, current.missing[0]).flatMap((candidate) => {
    const result = assess(candidate);
    const score = shelfScoreBounds(result);
    return score ? [score.min, score.max] : [];
  });
  if (!bounds.length) continue;
  const min = Math.min(...bounds), max = Math.max(...bounds);
  simulations.push({ id: row.productId, missing: current.missing[0], min, max, stableBand: band(min) === band(max) ? band(min) : null, scenarios: bounds.length });
}
const byMissing = Object.fromEntries([...new Set(simulations.map((row) => row.missing))].sort().map((missing) => {
  const rows = simulations.filter((row) => row.missing === missing);
  return [missing, { simulated: rows.length, stableBand: rows.filter((row) => row.stableBand).length,
    crossesBand: rows.filter((row) => !row.stableBand).length, widths: { min: Math.min(...rows.map((row) => row.max - row.min)),
      median: rows.map((row) => row.max - row.min).sort((a, b) => a - b)[Math.floor(rows.length / 2)], max: Math.max(...rows.map((row) => row.max - row.min)) } }];
}));
const report = { checkedAt: new Date().toISOString(), model: "simulation-only; production formula unchanged", observations: evidence.length,
  simulated: simulations.length, stableBand: simulations.filter((row) => row.stableBand).length,
  crossesBand: simulations.filter((row) => !row.stableBand).length, byMissing, simulations };
if (process.argv.includes("--write")) {
  await mkdir(".catalog-sync", { recursive: true });
  const file = ".catalog-sync/personal-fit-provisional-simulation.json";
  await writeFile(`${file}.tmp`, JSON.stringify(report, null, 2) + "\n");
  await rename(`${file}.tmp`, file);
}
console.log(JSON.stringify({ ...report, simulations: undefined }));
