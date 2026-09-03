import { readFile } from "node:fs/promises";
import { assessPersonalShelfProduct, hasContradictoryShelfNutrition } from "../src/lib/personal-shelf-rank";
import { parseShelfEvidence } from "../src/server/personal-shelf-evidence";

const rows: unknown[] = JSON.parse(await readFile("data/personal-shelf-evidence.generated.json", "utf8"));
const seen = new Set<string>();
const categories: Record<string, { total: number; scored: number }> = {};
const contradictions: string[] = [];
for (const row of rows) {
  const evidence = parseShelfEvidence(row);
  if (!evidence || !/^(?:barbora:|livinn_lt:)/.test(evidence.productId) || evidence.source === "open_food_facts") throw new Error("Invalid retailer observation or mixed license layer");
  if (seen.has(evidence.productId)) throw new Error(`Duplicate exact identity: ${evidence.productId}`);
  seen.add(evidence.productId);
  const assessment = assessPersonalShelfProduct({ id: evidence.productId, gtin: evidence.gtin, category: evidence.category, format: "other", shelfEvidence: evidence });
  const group = categories[assessment.category || "unsupported"] ||= { total: 0, scored: 0 };
  group.total++;
  if (assessment.score !== null) {
    group.scored++;
    if (!Number.isInteger(assessment.score) || assessment.score < 0 || assessment.score > 100 || assessment.components.some((part) => part.points < 0 || part.points > part.weight)) throw new Error(`Invalid pilot score: ${evidence.productId}`);
  }
  if (hasContradictoryShelfNutrition(evidence)) {
    if (assessment.score !== null) throw new Error(`Contradictory source was scored: ${evidence.productId}`);
    contradictions.push(evidence.productId);
  }
}
console.log(JSON.stringify({ observations: rows.length, scorable: Object.values(categories).reduce((n, group) => n + group.scored, 0), categories, contradictorySourceIds: contradictions }, null, 2));
