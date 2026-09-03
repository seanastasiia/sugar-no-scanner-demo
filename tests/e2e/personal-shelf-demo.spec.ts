import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const demoPath = "/demo/personal-shelf";

async function observeCamera(page: Page) {
  await page.addInitScript(() => {
    const counters = window as typeof window & { demoCameraRequests: number };
    counters.demoCameraRequests = 0;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => {
        counters.demoCameraRequests += 1;
        throw new DOMException("Camera intentionally denied by demo QA", "NotAllowedError");
      } }
    });
  });
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("rating demo deep link uses real catalog scores without camera or recognition calls", async ({ page }) => {
  await observeCamera(page);
  const apiCalls: string[] = [];
  page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) apiCalls.push(request.url()); });
  const response = await page.goto(demoPath);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Best fit first", exact: true })).toBeVisible();
  await expect(page.getByText("Demo", { exact: true })).toBeVisible();
  for (const removed of ["New rating demo", "Your example shelf", "Why this score?", "Consider:", "Scan your own shelf", "Selected catalog examples, not a live scan."]) {
    await expect(page.getByText(removed, { exact: true })).toHaveCount(0);
  }
  await expect(page.locator("footer")).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(0);
  const chips = page.getByRole("region", { name: "Chips", exact: true });
  await expect(page.getByRole("heading", { name: "Chips", exact: true })).toHaveCount(0);
  await expect(page.getByText("Chips", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByText("Yogurts", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Spoonable yogurts", exact: true })).toHaveCount(0);
  await expect(chips.getByTestId("demo-product-row")).toHaveCount(4);
  await expect(chips.getByText("64/100", { exact: true })).toBeVisible();
  await expect(chips.getByText("61/100", { exact: true })).toBeVisible();
  await expect(chips.getByText("57–59/100", { exact: true })).toBeVisible();
  await expect(chips.getByText("Provisional · fiber unknown", { exact: true })).toBeVisible();
  await expect(chips.getByText("#1", { exact: true })).toBeVisible();
  await expect(chips.getByText("#2", { exact: true })).toBeVisible();
  await expect(chips.getByText("Not scored", { exact: true })).toBeVisible();
  await expect(chips.getByText("Protein 5g · Sugar 0.6g /100 g", { exact: true })).toBeVisible();
  await expect(chips.getByText("Protein 4.8g · Sugar 0.6g /100 g", { exact: true })).toBeVisible();
  await expect(chips.getByTestId("demo-product-details").first()).toBeHidden();
  const firstChip = chips.getByTestId("demo-product-row").first();
  await firstChip.click();
  await expect(firstChip).toHaveAttribute("aria-expanded", "true");
  const details = chips.getByTestId("demo-product-details").first();
  await expect(details.locator("dt")).toHaveText(["Sugar", "Protein", "Food base", "Salt, saturates & fiber"]);
  await expect(details.locator("dd")).toHaveText(["10 / 10", "2.1 / 10", "22.5 / 30", "28.9 / 50"]);
  // Removed copy must not remain in hidden cards or keyboard-focusable links.
  await expect(chips.getByRole("link", { includeHidden: true })).toHaveCount(0);
  await expect(chips).not.toContainText(/Original ingredients|Per 100 g:|Checked \d|Model personal-shelf|Pilot preference score|Sudedamosios dalys/);
  await page.screenshot({ path: test.info().outputPath("compact-demo-expanded.png"), fullPage: true, animations: "disabled" });
  await firstChip.press("Enter");
  await expect(firstChip).toHaveAttribute("aria-expanded", "false");
  await chips.getByTestId("demo-product-row").last().click();
  await expect(chips.getByText(/Source table is inconsistent/)).toBeVisible();
  await expect(chips.getByTestId("demo-product-row").last()).not.toContainText("/100");
  await expect(chips).not.toContainText("57.8");
  await chips.getByTestId("demo-product-row").nth(2).click();
  await expect(chips.getByTestId("demo-product-details").nth(2)).toContainText("no fiber value is estimated");
  await expectNoOverflow(page);
  expect(await page.evaluate(() => (window as typeof window & { demoCameraRequests: number }).demoCameraRequests)).toBe(0);
  expect(apiCalls).toEqual([]);
  await page.reload();
  await expect(page.getByText("64/100", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { demoCameraRequests: number }).demoCameraRequests)).toBe(0);
});

test("rating demo is reachable from Show demo and can return to the unchanged scanner", async ({ page }) => {
  await observeCamera(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect(page.getByRole("button", { name: "Enable camera", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show demo", exact: true }).click();
  const entry = page.getByRole("link", { name: "New rating demo 4 real products with score breakdowns", exact: true });
  await expect(entry).toHaveAttribute("href", demoPath);
  const size = await entry.boundingBox();
  expect(size?.height).toBeGreaterThanOrEqual(44);
  await entry.click();
  await expect(page).toHaveURL(new RegExp(`${demoPath}$`));
  await expect(page.getByText("64/100", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to scanner", exact: true }).click();
  await expect(page.getByLabel("Live camera scanner")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable camera", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show demo", exact: true }).click();
  await page.getByRole("button", { name: /^Shelf demo/ }).click();
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Personal Shelf Rank Pilot", exact: true })).not.toBeChecked();
  await expect(page.getByRole("heading", { name: "Best fit first", exact: true })).toBeVisible();
});

test("rating demo handles broken packshots and remains accessible on small dark phones", async ({ page }, testInfo) => {
  await observeCamera(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.route("https://images.livinn.lt/**", (route) => route.abort());
  await page.goto(demoPath);
  // Wait for an onError-driven fallback, not just server HTML, before scrolling.
  await expect(page.getByTestId("demo-packshot-unavailable").first()).toBeVisible();
  await expect(page.getByTestId("demo-packshot-unavailable")).toHaveCount(4);
  await expect(page.getByText("64/100", { exact: true })).toBeVisible();
  await expectNoOverflow(page);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  const cardTarget = await page.getByTestId("demo-product-row").first().boundingBox();
  expect(cardTarget?.height).toBeGreaterThanOrEqual(44);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await page.getByTestId("demo-product-row").first().click();
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("rating-demo-dark-large-text.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 812, height: 375 });
  await expectNoOverflow(page);
  expect(await page.evaluate(() => (window as typeof window & { demoCameraRequests: number }).demoCameraRequests)).toBe(0);
});

test("rating demo displays compact Shelf-photo-style cards and exact packshots on mobile", async ({ page }, testInfo) => {
  await page.goto(demoPath);
  await expect(page.getByText("64/100", { exact: true })).toBeVisible();
  await expect(page.getByTestId("demo-packshot")).toHaveCount(4);
  await expect.poll(() => page.getByTestId("demo-packshot").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  // The fourth chip is the new real missing-fiber example. Keep the first three
  // cards above the fold and allow ordinary vertical scrolling for a longer list.
  const thirdCard = await page.getByTestId("demo-product-row").nth(2).boundingBox();
  expect(thirdCard!.y + thirdCard!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await expect(page.getByText("57–59/100", { exact: true })).toBeVisible();
  await page.getByTestId("demo-product-row").last().scrollIntoViewIfNeeded();
  await expect(page.getByTestId("demo-product-row").last()).toBeInViewport();
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("compact-demo-chips.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 320, height: 568 });
  await expectNoOverflow(page);
  await page.getByTestId("demo-product-row").first().click();
  await expectNoOverflow(page);
});
