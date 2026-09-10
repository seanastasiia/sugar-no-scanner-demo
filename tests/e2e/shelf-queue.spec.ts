import { expect, test } from "@playwright/test";
import { shelfFixture } from "../fixtures/personal-shelf";
import type { ShelfQueueItem } from "../../src/lib/shelf-queue";

test.skip(process.env.SHELF_RESEARCH_QUEUE_ENABLED !== "true", "Internal queue pilot is opt-in");

test("queue saves an offline product, resumes after reload and shows verified nutrition", async ({ page }) => {
  let offline = true;
  let rows: ShelfQueueItem[] = [];
  const keys: string[] = [];
  await page.route("**/api/pilot/shelf-queue", route => {
    keys.push(route.request().headers()["x-shelf-queue-key"]);
    if (offline) return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"queue_unavailable"}' });
    const body = route.request().postDataJSON();
    if (body.action === "enqueue") rows = [{ id: "a".repeat(64), lookup: body.items[0], status: "ready", reason: "Verified and ready to compare.", missing: [], result: shelfFixture(), updatedAt: new Date().toISOString() }];
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ items: rows }) });
  });
  await page.goto("/pilot/shelf/queue");
  await page.getByText("Add a product the scanner missed", { exact: true }).click();
  await page.getByLabel("Brand", { exact: true }).fill("QA fixture");
  await page.getByLabel("Product name", { exact: true }).fill("Chips");
  await page.getByLabel("Pack size, e.g. 150 ml").fill("100 g");
  await page.getByRole("button", { name: "Find this product" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not reach your queue" })).toContainText("saved in this browser");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("sugar-shelf-queue-outbox-v1") || "[]").length)).toBe(1);
  offline = false;
  await page.reload();
  await expect(page.getByText("Added", { exact: true })).toBeVisible();
  await page.getByText("Why this score", { exact: true }).click();
  await expect(page.getByText("Nutrition per 100 g", { exact: true })).toBeVisible();
  expect(new Set(keys).size).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("sugar-shelf-queue-outbox-v1") || "[]").length)).toBe(0);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("queue-ready.png"), fullPage: true, animations: "disabled" });
});

test("real-photo scan queues missing Shelf evidence without transmitting the image to the queue", async ({ page }) => {
  const product = shelfFixture("barbora:qa-queue", { ingredientsText: null });
  const received: unknown[] = [];
  const detection = { productId: product.id, catalogProductId: product.id, confidence: .99, box: { x: .1, y: .1, width: .6, height: .6 }, observedText: product.name,
    identity: { brand: product.brand, name: product.name, variant: null, packSize: "100g", category: "Chips", matchKind: "barbora" }, inlineProduct: product, shelfPrice: null, retailerOffer: null };
  await page.addInitScript(() => localStorage.setItem("sugar_scanner_onboarding_v1", "completed"));
  await page.route("**/api/pilot/shelf-queue", route => { const body = route.request().postDataJSON(); if (body.action === "enqueue") received.push(body); return route.fulfill({ contentType: "application/json", body: '{"items":[]}' }); });
  await page.route("**/api/recognize", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ requestId: "queue-qa", status: "matched", latencyMs: 1, model: "fixture", imageStored: false, detections: [detection] }) }));
  await page.route("**/api/resolve-products", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ detections: [detection], latencyMs: 1, imageStored: false }) }));
  await page.route("**/api/personal-shelf", route => route.fulfill({ contentType: "application/json", body: '{"evidence":{}}' }));
  await page.goto("/pilot/shelf");
  await page.getByRole("button", { name: "Show demo", exact: true }).click();
  await page.getByRole("dialog", { name: "See how it works" }).locator('input[type="file"]').setInputFiles({ name: "queue-qa.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
  await expect.poll(() => received.length).toBeGreaterThan(0);
  expect(JSON.stringify(received)).not.toMatch(/image|base64|observedText|shelfPrice|sessionId/);
  expect(received[0]).toMatchObject({ action: "enqueue", items: [{ productId: product.id, brand: product.brand }] });
});

test("launch root does not start queue calls or expose the internal queue", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", req => { if (req.url().includes("/api/pilot/shelf-queue")) calls.push(req.url()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Compare the shelf, not the labels." })).toBeVisible();
  await expect(page.getByRole("link", { name: /My products/ })).toHaveCount(0);
  expect(calls).toEqual([]);
});
