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
  await expect(page.getByRole("heading", { name: "Best products", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText("Personal Shelf Rank", { exact: true })).toBeVisible();
  await expect(page.getByText("Demo", { exact: true })).toBeVisible();
  await expect(page.getByText("Sugar · Protein · Ingredients · Salt · Saturated fat · Fiber", { exact: true })).toBeVisible();
  await expect(page.getByText("How scores work", { exact: true })).toBeVisible();
  for (const removed of ["Best fit first", "New rating demo", "Your example shelf", "Why this score?", "Consider:", "Scan your own shelf", "Selected catalog examples, not a live scan.", "Not scored"]) {
    await expect(page.getByText(removed, { exact: true })).toHaveCount(0);
  }
  await expect(page.locator("footer")).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(0);
  const chips = page.getByRole("region", { name: "Chips", exact: true });
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByText("Yogurts", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Spoonable yogurts", exact: true })).toHaveCount(0);
  const cards = chips.locator("li[data-personal-fit]");
  await expect(cards).toHaveCount(3);
  await expect(chips.getByText("64/100", { exact: true })).toBeVisible();
  await expect(chips.getByText("61/100", { exact: true })).toBeVisible();
  await expect(chips.getByText("57–59/100", { exact: true })).toBeVisible();
  await expect(chips.getByText("#1 of 3", { exact: true })).toBeVisible();
  await expect(chips.getByText("#2 of 3", { exact: true })).toBeVisible();
  await expect(chips.getByText("Provisional #3 of 3", { exact: true })).toBeVisible();
  await expect(chips.getByTestId("personal-fit-badge")).toHaveText(["Moderate fit", "Moderate fit", "Moderate fit"]);
  await expect(chips.locator('li[data-personal-fit="moderate"]')).toHaveCount(3);
  await expect(chips.getByLabel("Nutrition per 100 grams")).toHaveCount(0);
  const breakdowns = chips.locator("details[data-score-breakdown]");
  await expect(breakdowns).toHaveCount(3);
  await expect(chips.getByText("Why this score", { exact: true })).toHaveCount(3);
  await expect(chips.getByLabel("Score breakdown", { exact: true })).toHaveCount(2);
  await expect(chips.getByLabel("Provisional score breakdown", { exact: true })).toHaveCount(1);
  const closedDisclosureSpacing = await cards.first().evaluate((card) => {
    const disclosure = card.querySelector("details[data-score-breakdown]")!;
    const label = disclosure.querySelector("summary > span")!;
    const cardBox = card.getBoundingClientRect();
    const disclosureBox = disclosure.getBoundingClientRect();
    const labelBox = label.getBoundingClientRect();
    return {
      above: labelBox.top - disclosureBox.top,
      below: cardBox.bottom - labelBox.bottom
    };
  });
  expect(Math.abs(closedDisclosureSpacing.above - closedDisclosureSpacing.below)).toBeLessThanOrEqual(2);
  const criterionLists = breakdowns.locator('[role="list"][aria-label="Points by criterion"]');
  await expect(criterionLists).toHaveCount(3);
  await expect(criterionLists.first()).toBeHidden();
  await breakdowns.locator("summary").first().click();
  const firstBreakdown = breakdowns.first().getByRole("list", { name: "Points by criterion", exact: true });
  await expect(firstBreakdown).toBeVisible();
  await expect(firstBreakdown.getByRole("listitem")).toHaveCount(4);
  await expect(firstBreakdown.locator('[data-score-component="sugar"]')).toHaveAccessibleName(/^Sugar: \d+(?:\.\d)? of \d+ points$/);
  await expect(firstBreakdown.locator('[data-score-component="protein"]')).toHaveAccessibleName(/^Protein: \d+(?:\.\d)? of \d+ points$/);
  await expect(firstBreakdown.locator('[data-score-component="composition"]')).toHaveAccessibleName(/^Ingredients: \d+(?:\.\d)? of \d+ points$/);
  await expect(firstBreakdown.locator('[data-score-component="balance"]')).toHaveAccessibleName(/^Balance: \d+(?:\.\d)? of \d+ points$/);
  await breakdowns.last().locator("summary").click();
  const provisionalBalance = breakdowns.last().locator('[data-score-component="balance"]');
  await expect(provisionalBalance).toBeVisible();
  await expect(provisionalBalance).toHaveAttribute("aria-label", /^Balance: \d+(?:\.\d)?–\d+(?:\.\d)? of \d+ points$/);
  await expect(chips.getByRole("button")).toHaveCount(0);
  await expect(chips.getByRole("link", { includeHidden: true })).toHaveCount(0);
  await expect(chips).not.toContainText(/Original ingredients|Per 100 g:|Checked \d|Model personal-shelf|Pilot preference score|Sudedamosios dalys|Source table is inconsistent/);
  await expect(chips).not.toContainText("57.8");
  await page.getByText("How scores work", { exact: true }).click();
  const method = page.locator("details:not([data-score-breakdown])[open]");
  await expect(method.getByRole("heading", { name: "Up to 100 points, shaped around your priorities.", exact: true, level: 2 })).toBeVisible();
  await expect(method.locator("[data-method-intro] svg")).toHaveCount(0);
  await expect(method).toContainText("We compare only products of the same type");
  await expect(method.locator("li[data-signal]")).toHaveCount(4);
  await expect(method.getByText("5–40 pts", { exact: true })).toBeVisible();
  await expect(method.getByText("5–30 pts", { exact: true })).toBeVisible();
  await expect(method.getByText("20–35 pts", { exact: true })).toBeVisible();
  await expect(method.getByText("25–50 pts", { exact: true })).toBeVisible();
  await expect(method).toContainText("Full signal at 5 g per 100 g or less; zero at 22.5 g or more");
  await expect(method).toContainText("protein g × 4 ÷ kcal × 100");
  await expect(method).toContainText("below 12% is called out in the product explanation");
  await expect(method).toContainText("Salt scores from full at ≤0.3 g to zero at ≥1.5 g");
  await expect(method).toContainText("fiber reaches full credit at 6 g per 100 g");
  await expect(method.getByText("59-point ceiling", { exact: true })).toHaveCount(0);
  await expect(method).toContainText("missing optional fiber creates a provisional range");
  await expect(method).toContainText("This is a preference score, not a health rating");
  await expect(page.locator("dt")).toHaveCount(0);
  const methodAccessibility = await new AxeBuilder({ page })
    .include("details[open]")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(methodAccessibility.violations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("personal-shelf-demo-shared-cards.png"), fullPage: true, animations: "disabled" });
  await expectNoOverflow(page);
  expect(await page.evaluate(() => (window as typeof window & { demoCameraRequests: number }).demoCameraRequests)).toBe(0);
  expect(apiCalls).toEqual([]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Best products", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText("64/100", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { demoCameraRequests: number }).demoCameraRequests)).toBe(0);
});

test("rating demo is reachable from Show demo and can return to the unchanged scanner", async ({ page }) => {
  await observeCamera(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect(page.getByRole("button", { name: "Enable camera", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show demo", exact: true }).click();
  const entry = page.getByRole("link", { name: /^New rating demo 3 real products with Personal Fit/ });
  const shelfEntry = page.getByRole("button", { name: /^Shelf demo Compare several products at once/ });
  await expect(entry).toHaveAttribute("href", demoPath);
  const size = await entry.boundingBox();
  expect(size?.height).toBeGreaterThanOrEqual(44);
  const shelfSize = await shelfEntry.boundingBox();
  expect(size?.height).toBeCloseTo(shelfSize?.height ?? 0, 0);
  const rowStyles = (element: HTMLElement | SVGElement) => ({
    background: getComputedStyle(element).backgroundColor,
    radius: getComputedStyle(element).borderRadius,
    chevron: getComputedStyle(element, "::after").content,
    iconBackground: getComputedStyle(element.querySelector("svg")!).backgroundColor,
    iconColor: getComputedStyle(element.querySelector("svg")!).color,
    detailSize: getComputedStyle(element.querySelector("small")!).fontSize
  });
  const [ratingStyles, shelfStyles] = await Promise.all([
    entry.evaluate(rowStyles),
    shelfEntry.evaluate(rowStyles)
  ]);
  expect(ratingStyles).toEqual(shelfStyles);
  expect(ratingStyles.background).toBe("rgb(255, 255, 255)");
  expect(ratingStyles.radius).toBe("32px");
  expect(ratingStyles.chevron).toBe('"›"');
  await entry.click();
  await expect(page).toHaveURL(new RegExp(`${demoPath}$`));
  await expect(page.getByRole("heading", { name: "Best products", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText("64/100", { exact: true })).toBeVisible();
  const logoHome = page.getByRole("link", { name: "Sugar.no scanner home", exact: true });
  await expect(logoHome).toHaveAttribute("href", "/");
  const logoTarget = await logoHome.boundingBox();
  expect(logoTarget?.height).toBeGreaterThanOrEqual(44);
  await logoHome.click();
  await expect(page.getByLabel("Live camera scanner")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable camera", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show demo", exact: true }).click();
  await page.getByRole("button", { name: /^Shelf demo/ }).click();
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Personal Shelf Rank Pilot", exact: true })).not.toBeChecked();
  await expect(page.getByRole("region", { name: "Scan results", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Best fit first", exact: true })).toHaveCount(0);
});

test("rating demo handles broken packshots and remains accessible on small dark phones", async ({ page }, testInfo) => {
  await observeCamera(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.route("https://images.livinn.lt/**", (route) => route.abort());
  await page.goto(demoPath);
  // Wait for an onError-driven fallback, not just server HTML, before scrolling.
  await expect(page.getByTestId("demo-packshot-unavailable").first()).toBeVisible();
  await expect(page.getByTestId("demo-packshot-unavailable")).toHaveCount(3);
  await expect(page.getByText("64/100", { exact: true })).toBeVisible();
  await expectNoOverflow(page);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  const backTarget = await page.getByRole("link", { name: "Back to scanner", exact: true }).boundingBox();
  const methodTarget = await page.locator("details:not([data-score-breakdown]) > summary").boundingBox();
  expect(backTarget?.height).toBeGreaterThanOrEqual(44);
  expect(methodTarget?.height).toBeGreaterThanOrEqual(44);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await page.getByText("How scores work", { exact: true }).click();
  await expectNoOverflow(page);
  await expect(page.getByRole("list", { name: "Personal Fit score bands", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("rating-demo-dark-large-text.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 812, height: 375 });
  await expectNoOverflow(page);
  expect(await page.evaluate(() => (window as typeof window & { demoCameraRequests: number }).demoCameraRequests)).toBe(0);
});

test("rating demo displays compact Shelf-photo-style cards and exact packshots on mobile", async ({ page }, testInfo) => {
  await page.goto(demoPath);
  await expect(page.getByText("64/100", { exact: true })).toBeVisible();
  await expect(page.getByTestId("demo-packshot")).toHaveCount(3);
  await expect.poll(() => page.getByTestId("demo-packshot").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const cards = page.locator('li[data-personal-fit="moderate"]');
  await expect(cards).toHaveCount(3);
  await expect(page.getByText("57–59/100", { exact: true })).toBeVisible();
  await cards.last().scrollIntoViewIfNeeded();
  await expect(cards.last()).toBeInViewport();
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("compact-demo-chips.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 320, height: 568 });
  await expectNoOverflow(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expectNoOverflow(page);
});
