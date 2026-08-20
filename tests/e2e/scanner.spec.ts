import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function unlock(page: Page) {
  const response = await page.request.post("/api/auth", { data: { code: "e2e-access" } });
  expect(response.ok()).toBe(true);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /One camera/ })).toBeVisible();
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

test("sample shelf uses the recognition API and shows transparent product details", async ({ page }) => {
  await unlock(page);
  await page.getByRole("button", { name: /Shelf scene/ }).click();
  await expect(page.getByRole("status")).toContainText("4 supported products found");
  await expect(page.getByText("Sugar.no Match").first()).toBeVisible();
  await expect(page.getByText("More protein · More fiber · Less total sugar")).toBeVisible();
  await expect(page.getByText("Values per 100 g · Category-relative demo score")).toBeVisible();
  const retailer = page.getByRole("link", { name: /View at Barbora/ });
  await expect(retailer).toHaveAttribute("href", /^https:\/\/barbora\.lv\/produkti\//);
  await expect(page.getByText(/good|bad|unhealthy/i)).toHaveCount(0);
  await expect(page.getByLabel("Sample shelf with four supported protein snacks").locator("img")).toHaveCount(4);
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLImageElement>('div[aria-label="Sample shelf with four supported protein snacks"] img')]
      .every((image) => image.complete && image.naturalWidth > 0)
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "docs/screenshots/shelf-mobile.png", fullPage: true });
});

test("checkout scene builds a de-duplicated four-SKU tray", async ({ page }) => {
  await unlock(page);
  await page.getByRole("button", { name: /Checkout scene/ }).click();
  const tray = page.getByLabel("Products in this scan");
  await expect(tray).toBeVisible({ timeout: 8_000 });
  await expect(tray.getByRole("button")).toHaveCount(4, { timeout: 12_000 });
  await page.waitForTimeout(2_500);
  await expect(tray.getByRole("button")).toHaveCount(4);
  await expect(page.getByRole("status")).toContainText("4 unique products saved");
  await expect(page.getByText("Save a higher Match for your next shop")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "docs/screenshots/checkout-mobile.png", fullPage: true });
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
