import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

const expandedCategories = new Set([
  "veganiem-un-vegetariesiem",
  "gatavots-rimi"
]);

type AuditRecord = {
  id: string;
  source: string;
  sourceCategory: string | null;
  status: "scored" | "provisional" | "missing_data" | "unsupported" | "excluded";
  hasEvidence: boolean;
};

type AuditReport = {
  records: AuditRecord[];
};

const input = process.env.RIMI_EXPANSION_AUDIT || ".catalog-sync/personal-fit-catalog-audit.json";
const output = process.env.RIMI_EXPANSION_QUEUE || ".catalog-sync/rimi-expansion-evidence-ids.json";
const report = JSON.parse(await readFile(input, "utf8")) as AuditReport;
const inExpandedCategory = (record: AuditRecord) => expandedCategories.has(record.sourceCategory?.split(" > ")[0] || "");
const categoryRecords = report.records.filter((record) => record.source === "rimi_lv" && inExpandedCategory(record));
const ids = categoryRecords
  .filter((record) => record.status === "missing_data")
  .map((record) => record.id)
  .sort();

await mkdir(".catalog-sync", { recursive: true });
await writeFile(`${output}.tmp`, `${JSON.stringify(ids, null, 2)}\n`);
await rename(`${output}.tmp`, output);

console.log(JSON.stringify({
  expandedCategories: [...expandedCategories],
  categoryRecords: categoryRecords.length,
  alreadyAssessable: categoryRecords.filter((record) => record.status === "scored" || record.status === "provisional").length,
  queuedForExactEvidence: ids.length,
  unsupported: categoryRecords.filter((record) => record.status === "unsupported").length,
  output
}));
