import { shelfFixture } from "../fixtures/personal-shelf";
import { expect, test } from "@playwright/test";

test.skip(!process.env.META_PIXEL_ID, "Meta must be enabled for its dedicated consent checks");

test("Meta stays blocked until consent and revokes without breaking onboarding", async ({ page }) => {
  const requests: string[] = [];
  await page.route("https://connect.facebook.net/**", route => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: "application/javascript", body: "/* SDK intentionally mocked, never send QA traffic to Meta */" });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "No thanks", exact: true })).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "No thanks", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ad privacy", exact: true })).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "Ad privacy", exact: true }).click();
  await page.getByRole("button", { name: "Allow Meta cookies", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  const queue = () => page.evaluate(() => (window as unknown as { fbq: { queue: unknown[][] } }).fbq.queue);
  expect((await queue()).filter(args => args[2] === "PageView")).toHaveLength(1);
  await expect(page.locator("[data-meta-consent]")).toHaveCount(0);
  await page.reload();
  await expect.poll(() => requests.length).toBe(2);
  await expect(page.locator("[data-meta-consent]")).toHaveCount(0);
  await page.screenshot({ path: "test-results/meta-allowed-hidden.png" });
  await page.goto("/?privacy=1");
  await expect(page.getByRole("button", { name: "No thanks", exact: true })).toBeVisible();
  await expect.poll(() => requests.length).toBe(3);
  await page.getByRole("button", { name: "No thanks", exact: true }).click();
  expect((await queue()).at(-1)).toEqual(["consent", "revoke"]);
  expect((await queue()).filter(args => String(args[0]).startsWith("track"))).toEqual([]);
  await page.reload();
  await expect(page.getByRole("button", { name: "Ad privacy", exact: true })).toBeVisible();
  expect(requests).toHaveLength(3);
});

test("Meta removes free text URLs before loading and keeps the consent card within a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.route("https://connect.facebook.net/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.goto("/?utm_content=private%40example.com#private");
  const card = page.getByRole("region", { name: "Help us measure our ads?" });
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: "test-results/meta-consent-320.png" });
  await page.getByRole("button", { name: "Allow Meta cookies", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll("#scanner-meta-pixel").length)).toBe(1);
});


test("Ad privacy leaves result actions unobstructed on a small phone", async ({ page }) => {
  const products = [shelfFixture("meta-qa-a"), shelfFixture("meta-qa-b")];
  await page.route("**/api/recognize", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({
    requestId: "meta-layout-qa", status: "matched", latencyMs: 1, model: "qa-fixture", imageStored: false,
    detections: products.map((product, index) => ({
      productId: product.id, catalogProductId: product.id, confidence: .99,
      box: { x: .1 + index * .4, y: .1, width: .3, height: .4 }, observedText: product.name,
      identity: { brand: product.brand, name: product.name, variant: null, packSize: "100g", category: product.category, matchKind: "barbora" },
      inlineProduct: product, shelfPrice: null, retailerOffer: null
    }))
  }) }));
  await page.route("**/api/resolve-products", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ detections: route.request().postDataJSON().detections, latencyMs: 1, imageStored: false }) }));
  await page.route("**/api/offers", route => route.fulfill({ contentType: "application/json", body: '{"offers":{}}' }));
  await page.goto("/");
  await page.getByRole("button", { name: "No thanks", exact: true }).click();
  await page.getByRole("button", { name: "Not shopping yet — show me a sample", exact: true }).click();
  await page.getByRole("button", { name: "Scan this shelf", exact: true }).click();
  await page.getByRole("button", { name: "Explore all 4 results", exact: true }).click();
  for (const size of [{ width: 390, height: 844 }, { width: 320, height: 640 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    const privacy = page.getByRole("button", { name: "Ad privacy", exact: true });
    await expect(privacy).toBeVisible();
    const p = (await privacy.boundingBox())!;
    for (const name of ["Scan again", "View all"]) {
      const action = page.getByRole("button", { name, exact: true });
      await expect(action).toBeVisible();
      const a = (await action.boundingBox())!;
      expect(a.x < p.x + p.width && a.x + a.width > p.x && a.y < p.y + p.height && a.y + a.height > p.y).toBe(false);
      expect(await action.evaluate(element => { const b = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)); })).toBe(true);
    }
    await page.screenshot({ path: `test-results/meta-controls-${size.width}.png` });
  }
});
