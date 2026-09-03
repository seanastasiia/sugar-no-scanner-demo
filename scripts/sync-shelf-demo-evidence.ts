import { writeFile } from "node:fs/promises";
import { SHELF_DEMO_PRODUCTS } from "../src/lib/shelf-demo-products";
import { assessPersonalShelfProduct, normalizeIngredientText, type ShelfEvidence } from "../src/lib/personal-shelf-rank";
import { parseBarboraProductPage } from "../src/server/barbora-catalog";
import { barboraShelfEvidence } from "../src/server/personal-shelf-parser";
import { parseShelfEvidence } from "../src/server/personal-shelf-evidence";

// Four exact source reads only. No DB, image, model or search calls. Dry-run by default.
const apply = process.argv.includes("--apply");
console.log(JSON.stringify({ apply, requests: SHELF_DEMO_PRODUCTS.length }));
if (!apply) process.exit(0);
const rows: Array<{ title: string; evidence: ShelfEvidence }> = [];
for (const spec of SHELF_DEMO_PRODUCTS) {
  const url = `https://barbora.lv/produkti/${spec.id}`;
  const response = await fetch(url, {
    redirect: "error", signal: AbortSignal.timeout(12000),
    headers: { "user-agent": "Sugar.no demo evidence review/1.0 (https://sugar.no)" }
  });
  if (!response.ok) throw new Error(`${spec.id}: HTTP ${response.status}; Retry-After ${response.headers.get("retry-after") || "not specified"}`);
  const html = await response.text();
  if (html.length > 4_000_000) throw new Error("Source too large");
  const product = parseBarboraProductPage(html);
  const title = normalizeIngredientText(product?.title || "");
  if (product?.Url !== spec.id || !title.includes(spec.brand.toLowerCase()) || !/\bbatonins\b/.test(title) || !/\b55\s*g\b/.test(title)) {
    throw new Error(`${spec.id}: exact brand, bar form, 55g pack or source SKU changed`);
  }
  const evidence = barboraShelfEvidence(product, new Date().toISOString());
  if (!evidence || !parseShelfEvidence(evidence)) throw new Error(`${spec.id}: invalid source evidence`);
  const assessment = assessPersonalShelfProduct({ id: evidence.productId, gtin: evidence.gtin, category: evidence.category, format: "bar", shelfEvidence: evidence });
  if (!["scored", "provisional"].includes(assessment.status)) throw new Error(`${spec.id}: ${assessment.status}: ${assessment.missing.join(", ")}`);
  rows.push({ title: product.title, evidence });
  console.log(JSON.stringify({ id: evidence.productId, status: assessment.status, score: assessment.score, range: assessment.scoreRange }));
  await new Promise((done) => setTimeout(done, 700));
}
// All-or-nothing: a failed source never replaces the last complete demo snapshot.
await writeFile("data/shelf-demo-evidence.generated.json", JSON.stringify(rows, null, 2) + "\n");
console.log(JSON.stringify({ written: rows.length }));
