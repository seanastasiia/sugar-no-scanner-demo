import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { assessPersonalShelfProduct, shelfScoreBounds, type ShelfEvidence } from "../src/lib/personal-shelf-rank";
import { personalShelfFit } from "../src/lib/personal-shelf-fit";

const json = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, "utf8"));
const rows = [...await json<ShelfEvidence[]>("data/personal-shelf-evidence.generated.json"),
  ...await json<ShelfEvidence[]>("data/personal-shelf-off-evidence.generated.json")];
type Group = { observations: number; scored: number; provisional: number; missing: number; great: number; moderate: number; low: number;
  uncertainBand: number; capped: number; lowerBounds: number[]; upperBounds: number[]; missingReasons: Record<string, number> };
const categories: Record<string, Group> = {};
for (const evidence of rows) {
  const assessment = assessPersonalShelfProduct({ id: evidence.productId, gtin: evidence.gtin, category: evidence.category, format: "other", shelfEvidence: evidence });
  const group = categories[assessment.category || "unsupported"] ||= { observations: 0, scored: 0, provisional: 0, missing: 0,
    great: 0, moderate: 0, low: 0, uncertainBand: 0, capped: 0, lowerBounds: [], upperBounds: [], missingReasons: {} };
  group.observations++;
  if (assessment.status === "scored") group.scored++;
  else if (assessment.status === "provisional") group.provisional++;
  else group.missing++;
  const fit = personalShelfFit(assessment);
  if (fit?.tone === "great") group.great++;
  else if (fit?.tone === "moderate") group.moderate++;
  else if (fit?.tone === "low") group.low++;
  else if (fit) group.uncertainBand++;
  if (assessment.cap) group.capped++;
  const bounds = shelfScoreBounds(assessment);
  if (bounds) { group.lowerBounds.push(bounds.min); group.upperBounds.push(bounds.max); }
  for (const reason of assessment.missing) group.missingReasons[reason] = (group.missingReasons[reason] || 0) + 1;
}
const reportCategories = Object.fromEntries(Object.entries(categories).map(([category, group]) => {
  group.lowerBounds.sort((a, b) => a - b); group.upperBounds.sort((a, b) => a - b);
  const assessable = group.scored + group.provisional;
  const dominantBand = Math.max(group.great, group.moderate, group.low);
  const alerts = [
    ...(assessable >= 20 && dominantBand / assessable >= .95 ? ["at least 95% of assessable records share one coloured band"] : []),
    ...(group.observations >= 20 && assessable / group.observations < .2 ? ["fewer than 20% of observations are assessable"] : []),
    ...(assessable >= 20 && group.uncertainBand / assessable >= .5 ? ["at least 50% of assessable records cross a presentation band"] : [])
  ];
  return [category, { observations: group.observations, scored: group.scored, provisional: group.provisional, missing: group.missing,
    assessable, fitBands: { great: group.great, moderate: group.moderate, low: group.low, uncertain: group.uncertainBand }, capped: group.capped,
    scoreBounds: assessable ? { min: group.lowerBounds[0], medianLower: group.lowerBounds[Math.floor(assessable / 2)], max: group.upperBounds.at(-1) } : null,
    topMissingReasons: Object.entries(group.missingReasons).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([reason, count]) => ({ reason, count })), alerts }];
}));
const report = { checkedAt: new Date().toISOString(), observations: rows.length, categories: reportCategories,
  totals: Object.values(reportCategories).reduce((sum, group) => ({ assessable: sum.assessable + group.assessable, scored: sum.scored + group.scored,
    provisional: sum.provisional + group.provisional, missing: sum.missing + group.missing }), { assessable: 0, scored: 0, provisional: 0, missing: 0 }) };
if (process.argv.includes("--write")) {
  await mkdir(".catalog-sync", { recursive: true });
  const file = ".catalog-sync/personal-fit-quality-report.json";
  await writeFile(`${file}.tmp`, JSON.stringify(report, null, 2) + "\n");
  await rename(`${file}.tmp`, file);
}
console.log(JSON.stringify({ ...report.totals, observations: report.observations,
  categoryAlerts: Object.entries(report.categories).filter(([, group]) => group.alerts.length).map(([category, group]) => ({ category, alerts: group.alerts })) }));
