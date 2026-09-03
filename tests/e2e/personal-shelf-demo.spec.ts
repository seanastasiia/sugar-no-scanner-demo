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
  await expect(page.getByRole("heading", { name: "New rating demo", exact: true })).toBeVisible();
  await expect(page.getByText("Selected catalog examples, not a live scan.", { exact: true })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  const chips = page.getByRole("region", { name: "Chips", exact: true });
  const yogurt = page.getByRole("region", { name: "Spoonable yogurts", exact: true });
  await expect(chips.getByText("64/100", { exact: true })).toBeVisible();
  await expect(chips.getByText("61/100", { exact: true })).toBeVisible();
  await expect(chips.getByText("#1 of 2 in chips", { exact: true })).toBeVisible();
  await expect(chips.getByText("#2 of 2 in chips", { exact: true })).toBeVisible();
  await expect(chips.getByText("Not enough verified data", { exact: true })).toBeVisible();
  await expect(yogurt.getByText("97/100", { exact: true })).toBeVisible();
  await expect(yogurt.getByText("54/100", { exact: true })).toBeVisible();
  await expect(yogurt.getByText("#1 of 2 in spoonable yogurts", { exact: true })).toBeVisible();
  await chips.getByText("Why this score?", { exact: true }).first().click();
  await expect(chips.getByText("Original ingredients (lt)", { exact: true }).first()).toBeVisible();
  await expect(chips.locator("details[open]").getByRole("link", { name: "Open exact source" })).toHaveAttribute("href", "https://www.livinn.lt/p/go-pure-ekologiski-bulviu-traskuciai-su-juros-druska-125-g-03000011072");
  await chips.getByText("View available evidence", { exact: true }).click();
  await expect(chips.getByText(/Source table is inconsistent/)).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Enable camera", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show demo", exact: true }).click();
  const entry = page.getByRole("link", { name: "New rating demo 5 real products with scores and ingredients", exact: true });
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
  await page.getByRole("button", { name: "Shelf demo Compare several products at once", exact: true }).click();
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Personal Shelf Rank Pilot", exact: true })).not.toBeChecked();
  await expect(page.getByRole("heading", { name: "Best fit first", exact: true })).toBeVisible();
});

test("rating demo handles broken packshots and remains accessible on small dark phones", async ({ page }, testInfo) => {
  await observeCamera(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.route("https://images.livinn.lt/**", (route) => route.abort());
  await page.route("https://cdn.barbora.lv/**", (route) => route.abort());
  await page.goto(demoPath);
  // Wait for an onError-driven fallback, not just server HTML, before scrolling.
  await expect(page.getByTestId("demo-packshot-unavailable").first()).toBeVisible();
  await page.getByRole("link", { name: "Scan your own shelf", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByTestId("demo-packshot-unavailable")).toHaveCount(5);
  await page.getByRole("heading", { name: "New rating demo", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText("64/100", { exact: true })).toBeVisible();
  await expectNoOverflow(page);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await page.getByText("Why this score?", { exact: true }).first().click();
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("rating-demo-dark-large-text.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 812, height: 375 });
  await expectNoOverflow(page);
  expect(await page.evaluate(() => (window as typeof window & { demoCameraRequests: number }).demoCameraRequests)).toBe(0);
});

test("rating demo displays the existing ranked cards and exact packshots on mobile", async ({ page }, testInfo) => {
  await page.goto(demoPath);
  await expect(page.getByText("64/100", { exact: true })).toBeVisible();
  await expect(page.getByTestId("demo-packshot")).toHaveCount(5);
  await page.getByRole("link", { name: "Scan your own shelf", exact: true }).scrollIntoViewIfNeeded();
  await expect.poll(() => page.getByTestId("demo-packshot").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.getByRole("heading", { name: "New rating demo", exact: true }).scrollIntoViewIfNeeded();
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("rating-demo-mobile.png"), fullPage: true, animations: "disabled" });
});
