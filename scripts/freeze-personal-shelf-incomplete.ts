import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

type AuditRecord = {
  id: string;
  source: "barbora_lv" | "rimi_lv" | "livinn_lt" | "open_food_facts";
  status: string;
  hasEvidence: boolean;
  contradictoryNutrition: boolean;
};
type Audit = { checkedAt: string; commit: string; inputHashes: Record<string, string>; records: AuditRecord[] };
const audit = JSON.parse(await readFile(".catalog-sync/personal-fit-catalog-audit.json", "utf8")) as Audit;
if (!Array.isArray(audit.records) || !audit.records.length || !Number.isFinite(Date.parse(audit.checkedAt))) {
  throw new Error("Run catalog:audit:personal-fit -- --write before freezing the queue");
}
const ids = audit.records.filter((row) => row.status === "missing_data").map((row) => row.id).sort();
if (!ids.length || ids.length > 10_000 || new Set(ids).size !== ids.length) throw new Error("Invalid incomplete-product queue");
if (ids.some((id) => !/^(?:barbora:[a-z0-9-]+|(?:rimi_lv|livinn_lt):[A-Za-z0-9._~-]+|off:\d{8,14})$/.test(id))) {
  throw new Error("Incomplete-product queue contains an unsupported canonical ID");
}
const rows = audit.records.filter((row) => row.status === "missing_data");
const manifest = {
  frozenAt: new Date().toISOString(),
  auditCheckedAt: audit.checkedAt,
  auditCommit: audit.commit,
  inputHashes: audit.inputHashes,
  count: ids.length,
  bySource: Object.fromEntries(["barbora_lv", "rimi_lv", "livinn_lt", "open_food_facts"].map((source) => [source, rows.filter((row) => row.source === source).length])),
  withPriorEvidence: rows.filter((row) => row.hasEvidence).length,
  withoutPriorEvidence: rows.filter((row) => !row.hasEvidence).length,
  contradictoryNutrition: rows.filter((row) => row.contradictoryNutrition).length,
  idsSha256: createHash("sha256").update(JSON.stringify(ids)).digest("hex")
};
await mkdir(".catalog-sync", { recursive: true });
for (const [path, value] of [[".catalog-sync/personal-fit-incomplete-ids.json", ids], [".catalog-sync/personal-fit-incomplete-manifest.json", manifest]] as const) {
  await writeFile(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  await rename(`${path}.tmp`, path);
}
console.log(JSON.stringify(manifest, null, 2));
