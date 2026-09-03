import { readFile } from "node:fs/promises";
import { assessPersonalShelfProduct, hasContradictoryShelfNutrition, shelfScoreBounds } from "../src/lib/personal-shelf-rank";
import { parseShelfEvidence } from "../src/server/personal-shelf-evidence";
import { getCatalog } from "../src/lib/catalog";
import { SHELF_DEMO_PRODUCTS } from "../src/lib/shelf-demo-products";
import { shelfDemoPersonalProduct } from "../src/lib/shelf-demo-personal-rank";

const retailerRows: unknown[] = JSON.parse(await readFile("data/personal-shelf-evidence.generated.json", "utf8"));
const offRows: unknown[] = JSON.parse(await readFile("data/personal-shelf-off-evidence.generated.json", "utf8"));
const rows = [...retailerRows, ...offRows];
const seen = new Set<string>();
const categories: Record<string, { total: number; scored: number; provisional: number }> = {};
const contradictions: string[] = [];
for (const row of rows) {
  const evidence = parseShelfEvidence(row);
  if (!evidence || (retailerRows.includes(row) ? evidence.source === "open_food_facts" : evidence.source !== "open_food_facts")) throw new Error("Invalid observation or mixed license layer");
  if (seen.has(evidence.productId)) throw new Error(`Duplicate exact identity: ${evidence.productId}`);
  seen.add(evidence.productId);
  const assessment = assessPersonalShelfProduct({ id: evidence.productId, gtin: evidence.gtin, category: evidence.category, format: "other", shelfEvidence: evidence });
  const group = categories[assessment.category || "unsupported"] ||= { total: 0, scored: 0, provisional: 0 };
  group.total++;
  if (assessment.score !== null) {
    group.scored++;
    if (!Number.isInteger(assessment.score) || assessment.score < 0 || assessment.score > 100 || assessment.components.some((part) => part.points < 0 || part.points > part.weight)) throw new Error(`Invalid pilot score: ${evidence.productId}`);
    if (assessment.category !== "yogurt" && assessment.category !== "dairy-dessert") {
      const masked = assessPersonalShelfProduct({ id: evidence.productId, gtin: evidence.gtin, category: evidence.category, format: "other", shelfEvidence: { ...evidence, fiberG: null } });
      if (!masked.scoreRange || masked.scoreRange.min > assessment.score || masked.scoreRange.max < assessment.score) throw new Error(`Fiber bounds do not enclose the complete score: ${evidence.productId}`);
    }
  }
  if (assessment.scoreRange) {
    group.provisional++;
    const { min, max } = assessment.scoreRange;
    if (assessment.status !== "provisional" || evidence.fiberG !== null || assessment.score !== null ||
      !Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 100 || min > max || max - min > 10) throw new Error(`Invalid interval: ${evidence.productId}`);
  }
  if (hasContradictoryShelfNutrition(evidence)) {
    if (shelfScoreBounds(assessment)) throw new Error(`Contradictory source was scored: ${evidence.productId}`);
    contradictions.push(evidence.productId);
  }
}
for (const spec of SHELF_DEMO_PRODUCTS) {
  const original = getCatalog().find((product) => product.id === spec.id);
  if (!original) throw new Error(`Missing Shelf demo SKU: ${spec.id}`);
  const prepared = shelfDemoPersonalProduct(original);
  const assessment = assessPersonalShelfProduct(prepared);
  if (prepared.id !== `barbora:${spec.id}` || !parseShelfEvidence(prepared.shelfEvidence) || assessment.category !== "bar" || !shelfScoreBounds(assessment)) {
    throw new Error(`Missing exact Shelf demo assessment: ${spec.id}`);
  }
}
console.log(JSON.stringify({ observations: rows.length, demoObservations: SHELF_DEMO_PRODUCTS.length, complete: Object.values(categories).reduce((n, group) => n + group.scored, 0), provisional: Object.values(categories).reduce((n, group) => n + group.provisional, 0), categories, contradictorySourceIds: contradictions }, null, 2));
