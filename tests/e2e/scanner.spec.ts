import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function unlock(page: Page) {
  const response = await page.request.post("/api/auth", { data: { code: "e2e-access" } });
  expect(response.ok()).toBe(true);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /One camera/ })).toBeVisible();
}

async function waitForAlternativeImages(page: Page) {
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll<HTMLImageElement>('img[alt=""]')];
    return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0);
  });
}

test("private gate rejects the wrong code and accepts the configured code", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: "docs/screenshots/access-mobile.png", fullPage: true });
  await page.getByLabel("Investor access code").fill("wrong-code");
  await page.getByRole("button", { name: "Open demo" }).click();
  await expect(page.locator(".access-error")).toContainText("does not match");
  await page.getByLabel("Investor access code").fill("e2e-access");
  await page.getByRole("button", { name: "Open demo" }).click();
  await expect(page.getByRole("heading", { name: /One camera/ })).toBeVisible();
});

test("sample shelf photo highlights products and shows a three-signal Sugar.no badge", async ({ page }) => {
  await unlock(page);
  await page.getByRole("button", { name: /Shelf photo/ }).click();
  await expect(page.getByRole("status")).toContainText("4 supported products found");
  await expect(page.locator('button[aria-label^="Open "]')).toHaveCount(4);
  await expect(page.getByLabel("Sugar.no badge")).toBeVisible();
  await expect(page.getByLabel("Sugar.no badge").getByText("Protein")).toBeVisible();
  await expect(page.getByLabel("Sugar.no badge").getByText("Fiber")).toBeVisible();
  await expect(page.getByLabel("Sugar.no badge").getByText("Sugar", { exact: true })).toBeVisible();
  await expect(page.getByText("Values per 100 g · Compared with protein snacks in this demo")).toBeVisible();
  await expect(page.getByText(/Sugar\.no Match \d+/)).toHaveCount(0);
  const retailer = page.getByRole("link", { name: /View at Barbora/ });
  await expect(retailer).toHaveAttribute("href", /^https:\/\/barbora\.lv\/produkti\//);
  await expect(page.getByText(/\b(good|bad|unhealthy)\b/i)).toHaveCount(0);
  await expect(page.getByLabel("Sample shelf photo with four supported protein snacks").locator("img")).toHaveCount(4);
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLImageElement>('div[aria-label="Sample shelf photo with four supported protein snacks"] img')]
      .every((image) => image.complete && image.naturalWidth > 0)
  );
  await waitForAlternativeImages(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "docs/screenshots/shelf-mobile.png", fullPage: true });
});

test("checkout photo uses one multi-product scan instead of an animated product", async ({ page }) => {
  await unlock(page);
  await page.getByRole("button", { name: /Checkout photo/ }).click();
  const tray = page.getByLabel("Products in this scan");
  await expect(tray).toBeVisible({ timeout: 8_000 });
  await expect(tray.getByRole("button")).toHaveCount(4);
  await expect(page.locator('button[aria-label^="Open "]')).toHaveCount(4);
  await expect(page.getByRole("status")).toContainText("4 supported products found on checkout");
  await expect(page.getByText("Save an option for your next shop")).toBeVisible();
  await waitForAlternativeImages(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "docs/screenshots/checkout-mobile.png", fullPage: true });
});

test("scanner remains operable at narrow portrait and phone landscape sizes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await unlock(page);
  await page.getByRole("button", { name: /Shelf photo/ }).click();
  await expect(page.getByLabel("Sugar.no badge")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 812, height: 375 });
  await expect(page.getByRole("button", { name: "Close scanner" })).toBeVisible();
  await expect(page.getByLabel("Sugar.no badge")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("sample response and analytics reject raw image storage", async ({ page }) => {
  await unlock(page);
  const recognition = await page.request.post("/api/recognize", {
    data: { source: "sample-shelf" }
  });
  expect(recognition.ok()).toBe(true);
  const response = await recognition.json();
  expect(response.imageStored).toBe(false);
  expect(response.detections).toHaveLength(4);

  const unsafeEvent = await page.request.post("/api/events", {
    data: {
      sessionId: crypto.randomUUID(),
      name: "scan_started",
      source: "camera",
      metadata: { imageDataUrl: "data:image/jpeg;base64,YWJj" }
    }
  });
  expect(unsafeEvent.status()).toBe(400);
  expect(await unsafeEvent.json()).toEqual({ error: "unsafe_event_metadata" });
});

test("camera permission denial offers a clear retry state", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(new DOMException("Denied in test", "NotAllowedError"))
      }
    });
  });
  await unlock(page);
  await page.getByRole("button", { name: "Start live camera" }).click();
  await expect(page.getByText("Camera permission is off")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("saved images are resized client-side and fail closed without a provider key", async ({ page }) => {
  await unlock(page);
  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "unknown.png",
    mimeType: "image/png",
    buffer: onePixelPng
  });
  await expect(page.getByRole("status")).toContainText("Live recognition needs the Gemini key");
  await expect(page.getByText("Point at the front of a package")).toBeVisible();
});

test("entry experience has no automated WCAG A/AA violations", async ({ page }) => {
  await unlock(page);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(150);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations).toEqual([]);
});
