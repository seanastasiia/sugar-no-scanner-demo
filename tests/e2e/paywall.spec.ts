import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
  const dialog = page.getByRole("dialog", { name: "Keep comparing products" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("€2.99", { exact: true })).toBeVisible();
  await expect(dialog.getByText("one-time payment")).toBeVisible();
  await expect(dialog.getByText(/No subscription or automatic renewal/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Continue for €2.99" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Not now" })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("paywall.png"), fullPage: true, animations: "disabled" });
  await expect.poll(() => events.some((event) => event.name === "paywall_viewed" &&
    (event.metadata as Record<string, unknown>)?.utm_source === "meta")).toBe(true);
});

test("the remaining free-scan allowance is visible before the paywall", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("3 free scans left", { exact: true })).toBeVisible();
});

test("a successful checkout confirms access before starting the camera", async ({ page }) => {
  await page.unroute("**/api/billing/status");
  await page.route("**/api/billing/status", (route) => route.fulfill({
    contentType: "application/json",
    body: '{"active":true,"scanSource":"camera"}'
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
  await expect(success.getByText("Your 7-day scanner access is active.")).toBeVisible();
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
  const dialog = page.getByRole("dialog", { name: "Keep comparing products" });
  await dialog.getByRole("button", { name: "Continue for €2.99" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Payment could not open");
  await dialog.getByRole("button", { name: "Already paid? Restore access" }).click();
  await dialog.getByLabel("Email used at checkout").fill("pilot@example.com");
  await dialog.getByRole("button", { name: "Email me a link" }).click();
  await expect(dialog.getByRole("status")).toContainText("If an active purchase exists");
});
