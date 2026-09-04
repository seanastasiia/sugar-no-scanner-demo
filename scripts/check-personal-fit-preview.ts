import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { webkit, devices, expect } from "@playwright/test";
import { assessPersonalShelfProduct, type ShelfEvidence } from "../src/lib/personal-shelf-rank";
import { getShelfEvidence, shelfEvidenceCounts } from "../src/server/personal-shelf-evidence";
import type { ExternalCatalogProduct } from "../src/server/external-catalog-types";

const baseURL = "https://sugar-no-personal-rank-personal-rank-preview.up.railway.app";
const expected = process.env.PREVIEW_EXPECTED_COMMIT;
if (!expected || !/^[a-f0-9]{40}$/.test(expected)) throw new Error("Set exact PREVIEW_EXPECTED_COMMIT before HTTPS smoke");
await mkdir("test-results", { recursive: true });
const browser = await webkit.launch();
try {
  const context = await browser.newContext({ ...devices["iPhone 13"], baseURL, serviceWorkers: "block" });
  const page = await context.newPage();
  await page.addInitScript(() => Object.defineProperty(navigator, "mediaDevices", { configurable: true,
    value: { getUserMedia: async () => { throw new DOMException("QA denied", "NotAllowedError"); } } }));
  const health = await (await context.request.get("/api/health")).json();
  assert.equal(health.commit, expected);
  assert.equal(health.catalog.personalShelf.model, "personal-shelf-v1.5-bounded");
  assert.deepEqual(health.catalog.personalShelf, shelfEvidenceCounts());
  const regional = JSON.parse(await readFile("data/open-food-facts-regional.generated.json", "utf8")) as ExternalCatalogProduct[];
  const original = JSON.parse(await readFile("data/open-food-facts-lv.generated.json", "utf8")) as ExternalCatalogProduct[];
  assert.equal(health.catalog.openFoodFactsBulkProducts, original.length + regional.length);
  assert.equal(health.features.sharedWebCatalog, false);
  assert.equal(health.features.sharedWebShelfEvidence, false);
  assert.equal((await page.goto("/?onboarding=1"))?.status(), 200);
  await page.getByRole("button", { name: "Try a sample shelf", exact: true }).click();
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Best fit first", exact: true })).toBeVisible();
  await page.getByRole("switch", { name: /Personal Shelf Rank/ }).click();
  await expect(page.getByRole("heading", { name: "Snack bars", exact: true })).toBeVisible();
  const ids = ["barbora:krej-jogurts-ar-mango-pasif-gran-wd-200-g", "barbora:siers-edam-jaunpils-skeles-150-g", "rimi_lv:1000513"];
  const regionalAssessed = regional.find((p) => {
    const e = getShelfEvidence(`off:${p.sourceProductId}`);
    return e && ["scored", "provisional"].includes(assessPersonalShelfProduct({ id: e.productId, gtin: e.gtin, category: e.category, format: "other", shelfEvidence: e }).status);
  });
  if (regional.length) {
    assert(regionalAssessed, "No newly imported OFF record gained Personal Fit evidence");
    ids.push(`off:${regionalAssessed.sourceProductId}`);
  }
  const response = await context.request.post("/api/personal-shelf", { data: { ids }, headers: { origin: baseURL } });
  assert.equal(response.status(), 200);
  const evidence = (await response.json()).evidence as Record<string, ShelfEvidence>;
  const assessments = ids.map((id) => {
    const e = evidence[id]; assert(e, `Missing exact new evidence: ${id}`);
    assert.deepEqual(e, getShelfEvidence(id), `Deployed exact observation differs: ${id}`);
    const result = assessPersonalShelfProduct({ id, gtin: e.gtin, category: e.category, format: "other", shelfEvidence: e });
    assert(["scored", "provisional"].includes(result.status));
    return { id, status: result.status, score: result.score, range: result.scoreRange };
  });
  const regionalChecks: { id: string; basis: string; ingredientLanguage: string | null }[] = [];
  for (const basis of ["100g", "100ml"] as const) {
    const product = regional.find((p) => p.nutritionBasis === basis);
    if (!product) continue;
    const res = await context.request.post("/api/barcode", { data: { barcode: product.gtin }, headers: { origin: baseURL } });
    assert.equal(res.status(), 200);
    const body = await res.json();
    assert.equal(body.status, "matched"); assert.equal(body.imageStored, false);
    assert.equal(body.detection.inlineProduct.nutritionBasis, basis);
    assert.equal(body.detection.inlineProduct.id, `off:${product.sourceProductId}`);
    const language = getShelfEvidence(`off:${product.sourceProductId}`)?.ingredientsLanguage ?? null;
    assert.equal(body.detection.inlineProduct.shelfEvidence.ingredientsLanguage, language);
    assert.equal(body.detection.inlineProduct.nutrientsPer100g.totalSugarG, product.totalSugarG);
    assert.equal(body.detection.inlineProduct.nutrientsPer100g.proteinG, product.proteinG);
    assert.match(body.detection.identity.packSize, basis === "100ml" ? /ml$/ : /g$/);
    regionalChecks.push({ id: `off:${product.sourceProductId}`, basis, ingredientLanguage: language });
  }
  for (const source of ["sample-shelf", "sample-conveyor"]) {
    const res = await context.request.post("/api/recognize", { data: { source }, headers: { origin: baseURL } });
    assert.equal(res.status(), 200);
    const body = await res.json(); assert.equal(body.imageStored, false);
    assert.equal(body.detections.length, source === "sample-shelf" ? 4 : 3);
  }
  assert.equal((await page.goto("/demo/personal-shelf"))?.status(), 200);
  await expect(page.getByTestId("demo-product-row")).toHaveCount(4);
  for (const score of ["64/100", "61/100", "57–59/100"]) await expect(page.getByText(score, { exact: true })).toBeVisible();
  await expect(page.getByText("Not scored", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/personal-fit-expansion-live.png", fullPage: true });
  const result = { checkedAt: new Date().toISOString(), health, assessments, regionalChecks, sampleAndCheckout: "passed", demo: "passed" };
  await writeFile("test-results/personal-fit-expansion-live.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
