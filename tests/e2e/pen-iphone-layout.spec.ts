import { expect, test, type Locator, type Page } from "@playwright/test";

const viewports = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 402, height: 874 },
  { width: 440, height: 956 },
  { width: 667, height: 375 },
  { width: 874, height: 402 }
];

async function unobstructed(control: Locator) {
  await expect(control).toBeVisible();
  expect(await control.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewport = window.visualViewport;
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return rect.left >= 0 && rect.top >= 0 && rect.right <= (viewport?.width || innerWidth) + 1 &&
      rect.bottom <= (viewport?.height || innerHeight) + 1 && !!hit && element.contains(hit);
  })).toBe(true);
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

async function siblingsDoNotOverlap(container: Locator) {
  const overlaps = await container.evaluate((element) => {
    const nodes = Array.from(element.children).filter((child) => getComputedStyle(child).display !== "none");
    return nodes.flatMap((node, index) => {
      const a = node.getBoundingClientRect();
      return nodes.slice(index + 1).flatMap((other) => {
        const b = other.getBoundingClientRect();
        return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
          ? [`${node.textContent?.trim()} / ${other.textContent?.trim()}`] : [];
      });
    });
  });
  expect(overlaps).toEqual([]);
}

test("Pen screens remain readable and actionable across iPhone sizes and rotation", async ({ page }) => {
  test.setTimeout(100_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of viewports) {
    await test.step(`${viewport.width}x${viewport.height}`, async () => {
      await page.setViewportSize(viewport);
      await page.goto("/?onboarding=1");
      await expect(page.getByRole("heading", { name: "Find a better fit." })).toBeVisible();
      await expect.poll(() => page.locator("img").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
      await unobstructed(page.getByRole("button", { name: "Open camera", exact: true }));
      await unobstructed(page.getByRole("button", { name: "Try a sample shelf", exact: true }));
      await noOverflow(page);
      await page.screenshot({ scale: "css", path: `test-results/pen-welcome-${viewport.width}x${viewport.height}.png` });
      await page.getByRole("button", { name: "Try a sample shelf", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("4 products · 4 with Sugar.no fit");
      const preview = page.getByLabel("Product result preview");
      if (viewport.width < viewport.height) {
        const cards = preview.getByRole("button");
        await expect(cards).toHaveCount(4);
        await expect.poll(() => preview.evaluate((element) => {
          const viewport = element.getBoundingClientRect();
          const first = element.children[0].getBoundingClientRect();
          const second = element.children[1].getBoundingClientRect();
          return { firstFits: first.top >= viewport.top - 1 && first.bottom <= viewport.bottom + 1,
            nextVisible: Math.round((viewport.bottom - second.top) / second.height * 100) };
        })).toEqual({ firstFits: true, nextVisible: 30 });
        const actionsBefore = await page.getByRole("button", { name: "View all", exact: true }).boundingBox();
        await preview.focus();
        await page.keyboard.press("ArrowDown");
        await expect.poll(() => preview.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
        for (const card of await cards.all()) {
          await card.scrollIntoViewIfNeeded();
          await unobstructed(card);
          await siblingsDoNotOverlap(card);
          await siblingsDoNotOverlap(card.locator(":scope > span").last());
          expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        }
        const actionsAfter = await page.getByRole("button", { name: "View all", exact: true }).boundingBox();
        expect(actionsAfter?.y).toBe(actionsBefore?.y);
        await cards.last().click();
        await expect(page.getByRole("heading", { name: "Lemon Cheesecake", exact: true })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(cards.last()).toBeFocused();
        await unobstructed(cards.last());
        await preview.evaluate((element) => element.scrollTo({ top: 0, behavior: "instant" }));
        await expect.poll(() => preview.evaluate((element) => element.scrollTop)).toBe(0);
      }
      await unobstructed(page.getByRole("button", { name: "View all", exact: true }));
      await unobstructed(page.getByRole("button", { name: "Scan again", exact: true }));
      await page.screenshot({ scale: "css", path: `test-results/pen-compact-${viewport.width}x${viewport.height}.png` });
      await page.getByRole("button", { name: "View all", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Products from this scan" });
      const ranking = dialog.getByLabel("Products ranked by Sugar.no fit");
      await expect(ranking.getByRole("button")).toHaveCount(4);
      await unobstructed(dialog.getByRole("button", { name: "Collapse product results" }));
      for (const card of await ranking.locator(":scope > li").all()) {
        await siblingsDoNotOverlap(card);
        const content = card.getByRole("button").locator(":scope > div").last();
        await siblingsDoNotOverlap(content);
        expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      }
      await noOverflow(page);
      await page.screenshot({ scale: "css", path: `test-results/pen-results-${viewport.width}x${viewport.height}.png` });
      await ranking.getByRole("button").first().click();
      await expect(dialog.getByRole("heading", { name: "Salty Peanut", exact: true })).toBeVisible();
      await unobstructed(dialog.getByRole("button", { name: "Back to all results" }));
      const packshot = dialog.getByTestId("product-packshot").first();
      const photo = await packshot.locator("..").boundingBox();
      expect(Math.abs((photo?.width || 0) - (photo?.height || 0))).toBeLessThanOrEqual(1);
      const retailer = dialog.getByRole("region", { name: "Product price" }).getByRole("link", { name: /Buy cheaper online/ });
      await retailer.scrollIntoViewIfNeeded();
      await unobstructed(retailer);
      await siblingsDoNotOverlap(retailer);
      expect(await retailer.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await noOverflow(page);
      await page.screenshot({ scale: "css", path: `test-results/pen-detail-${viewport.width}x${viewport.height}.png` });
    });
  }
});

test("Pen feedback keeps close and submit clear when iPhone space shrinks", async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/feedback", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) }));
  await page.goto("/?onboarding=1");
  await page.getByRole("button", { name: "Try a sample shelf", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("4 products · 4 with Sugar.no fit");
  for (const viewport of [...viewports, { width: 390, height: 360 }]) {
    await test.step(`${viewport.width}x${viewport.height}`, async () => {
      // Open before shrinking so the final case models the available area after a keyboard appears.
      await page.setViewportSize({ width: viewport.width, height: Math.max(667, viewport.height) });
      await page.getByRole("button", { name: "Leave feedback", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Was this scan helpful?" });
      await dialog.getByRole("button", { name: "Needs work" }).click();
      await dialog.getByLabel("Result was unclear").check();
      const comment = dialog.getByPlaceholder("Tell us what you noticed");
      await comment.fill("A long comment to check the space available on a small screen. ".repeat(5).slice(0, 300));
      await page.setViewportSize(viewport);
      await expect.poll(() => dialog.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.bottom <= (window.visualViewport?.height || innerHeight) + 1;
      })).toBe(true);
      await unobstructed(dialog.getByRole("button", { name: "Close feedback" }));
      await unobstructed(dialog.getByRole("button", { name: "Send feedback" }));
      await siblingsDoNotOverlap(dialog);
      await siblingsDoNotOverlap(dialog.locator("form"));
      await comment.scrollIntoViewIfNeeded();
      await unobstructed(comment);
      await noOverflow(page);
      await page.screenshot({ scale: "css", path: `test-results/pen-feedback-${viewport.width}x${viewport.height}.png` });
      await dialog.getByRole("button", { name: "Send feedback" }).click();
      const success = page.getByRole("dialog", { name: "Thank you" });
      await expect(success).toBeVisible();
      await expect.poll(() => success.evaluate((el) => el.getBoundingClientRect().top)).toBeCloseTo(viewport.height <= 600 ? 16 : Math.min(265, viewport.height * 0.3), 0);
      await unobstructed(success.getByRole("button", { name: "Close feedback" }));
      await unobstructed(success.getByRole("button", { name: "Done", exact: true }));
      await siblingsDoNotOverlap(success);
      await page.screenshot({ scale: "css", path: `test-results/pen-success-${viewport.width}x${viewport.height}.png` });
      await success.getByRole("button", { name: "Done", exact: true }).click();
    });
  }
});
