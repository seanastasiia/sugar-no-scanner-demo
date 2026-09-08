import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

async function expectSeparated(
  first: import("@playwright/test").Locator,
  second: import("@playwright/test").Locator,
  minimumGap = 0
) {
  const [firstBox, secondBox] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  const horizontalGap = Math.max(
    (secondBox?.x ?? 0) - ((firstBox?.x ?? 0) + (firstBox?.width ?? 0)),
    (firstBox?.x ?? 0) - ((secondBox?.x ?? 0) + (secondBox?.width ?? 0))
  );
  const verticalGap = Math.max(
    (secondBox?.y ?? 0) - ((firstBox?.y ?? 0) + (firstBox?.height ?? 0)),
    (firstBox?.y ?? 0) - ((secondBox?.y ?? 0) + (secondBox?.height ?? 0))
  );
  expect(Math.max(horizontalGap, verticalGap)).toBeGreaterThanOrEqual(minimumGap);
}

async function authenticate(page: import("@playwright/test").Page) {
  const response = await page.request.post("/api/auth", {
    headers: { origin: `http://127.0.0.1:${process.env.E2E_PORT || "3000"}` },
    data: { code: "e2e-demo-code" }
  });
  expect(response.status()).toBe(200);
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/billing/status", (route) => route.fulfill({ contentType: "application/json", body: '{"active":false}' }));
  await page.addInitScript(() => {
    localStorage.setItem("sugar_scanner_onboarding_v1", "completed");
  });
  await authenticate(page);
});

test("three successful scans lead to a clear one-time offer", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("sugar_scanner_free_scans_v1", "3"));
  const events: Array<Record<string, unknown>> = [];
  await page.route("**/api/events", async (route) => {
    events.push(route.request().postDataJSON());
    await route.fulfill({ contentType: "application/json", body: '{"ok":true}' });
  });
  await page.goto("/?utm_source=meta&utm_campaign=riga-pilot&utm_content=video-a");
  const dialog = page.getByRole("dialog", { name: "Keep scanning shelves" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("€2.99", { exact: true })).toBeVisible();
  await expect(dialog.getByText("one payment")).toBeVisible();
  await expect(dialog.getByText(/Nothing renews/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Unlock 7 days for €2.99" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Not now" })).toBeVisible();
  await page.waitForTimeout(400);
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("paywall.png"), fullPage: true, animations: "disabled" });
  await expect.poll(() => events.some((event) => event.name === "paywall_viewed" &&
    (event.metadata as Record<string, unknown>)?.utm_source === "meta")).toBe(true);
});

test("the remaining free-scan allowance is visible before the paywall", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("3 free scans left", { exact: true })).toBeVisible();
});

test("the access badge never overlaps camera or saved-photo content", async ({ page }) => {
  await page.route("**/api/recognize", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      requestId: "badge-layout-check",
      status: "not_sure",
      latencyMs: 1,
      model: "qa-mock",
      imageStored: false,
      detections: []
    })
  }));
  await page.goto("/");

  const badge = page.getByText("3 free scans left", { exact: true });
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 }
  ]) {
    await page.setViewportSize(viewport);
    await expectSeparated(badge, page.getByAltText("Sugar.no"), 8);
    await expectSeparated(badge, page.getByRole("button", { name: "Leave feedback" }));
    await expectSeparated(badge, page.getByRole("button", { name: "Show demo" }));
    await expectSeparated(badge, page.getByTestId("camera-viewport"), 8);
  }

  await page.getByRole("button", { name: "Show demo" }).click();
  const chooser = page.getByRole("dialog", { name: "See how a shelf scan works" });
  await chooser.locator('input[type="file"]').setInputFiles({
    name: "badge-layout-check.png",
    mimeType: "image/png",
    buffer: onePixelPng
  });
  await expect(page.getByRole("heading", { name: "Read a saved photo" })).toBeVisible();

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 }
  ]) {
    await page.setViewportSize(viewport);
    await expectSeparated(badge, page.getByAltText("Sugar.no"), 8);
    await expectSeparated(badge, page.getByRole("button", { name: "Leave feedback" }));
    await expectSeparated(badge, page.getByRole("heading", { name: "Read a saved photo" }), 8);
    await expectSeparated(badge, page.getByTestId("camera-viewport"), 8);
  }
});

test("a successful checkout confirms access before starting the camera", async ({ page }) => {
  await page.unroute("**/api/billing/status");
  await page.route("**/api/billing/status", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      active: true,
      scanSource: "camera",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString()
    })
  }));
  await page.addInitScript(() => {
    let cameraRequests = 0;
    Object.defineProperty(window, "__paymentCameraRequests", { get: () => cameraRequests, configurable: true });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          cameraRequests += 1;
          throw new DOMException("Permission denied for QA", "NotAllowedError");
        }
      }
    });
  });

  await page.goto("/?checkout=success&session_id=cs_test_success");
  const success = page.getByRole("dialog", { name: "You’re all set" });
  await expect(success).toBeVisible();
  await expect(success.getByText(/Unlimited scanning is active\. 7 days left\./)).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __paymentCameraRequests: number }).__paymentCameraRequests)).toBe(0);
  await success.getByRole("button", { name: "Start scanning" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __paymentCameraRequests: number }).__paymentCameraRequests)).toBe(1);
  await expect(page.getByRole("button", { name: "Enable camera" })).toBeVisible();
});

test("checkout and access restoration have recoverable states", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sugar_scanner_free_scans_v1", "3"));
  await page.route("**/api/events", (route) => route.fulfill({ contentType: "application/json", body: '{"ok":true}' }));
  await page.route("**/api/billing/restore/request", (route) => route.fulfill({ contentType: "application/json", body: '{"ok":true}' }));
  await page.route("**/api/billing/checkout", (route) => route.fulfill({ contentType: "application/json", body: '{"error":"checkout_failed"}', status: 502 }));
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Keep scanning shelves" });
  await dialog.getByRole("button", { name: "Unlock 7 days for €2.99" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Payment could not open");
  await dialog.getByRole("button", { name: "Restore purchase" }).click();
  await dialog.getByLabel("Email used at checkout").fill("pilot@example.com");
  await dialog.getByRole("button", { name: "Email me a link" }).click();
  await expect(dialog.getByRole("status")).toContainText("If an active purchase exists");
});

test("paid access shows whole days remaining and deterministic demos hide the badge", async ({ page }) => {
  await page.unroute("**/api/billing/status");
  await page.route("**/api/billing/status", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ active: true, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString() })
  }));
  await page.goto("/");
  await expect(page.getByText("7 days left", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show demo" }).click();
  await page.getByRole("button", { name: /^Shelf demo/ }).click();
  await expect(page.getByText(/days left$/, { exact: false })).toHaveCount(0);
});

test("expired access opens the renewal offer and allows another seven-day purchase", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sugar_scanner_free_scans_v1", "3"));
  await page.unroute("**/api/billing/status");
  await page.route("**/api/billing/status", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ active: false, expired: true, expiresAt: new Date(Date.now() - 1_000).toISOString() })
  }));
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Your 7 days have ended" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Unlock another 7 days of unlimited scanning.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Unlock 7 more days for €2.99" })).toBeVisible();
});
