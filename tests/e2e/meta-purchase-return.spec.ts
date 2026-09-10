import { expect, test } from "@playwright/test";

test.skip(!process.env.META_PIXEL_ID || process.env.WTP_PAYWALL_ENABLED !== "true", "Requires Meta and billing");

test("paid return with a detailed referrer sends one Purchase after private redirect", async ({ page }) => {
  const purchase = { eventId: `purchase_${"d".repeat(64)}`, value: 2.99, currency: "EUR" };
  await page.addInitScript(() => {
    localStorage.setItem("sugar-scanner-meta-consent-v1", "granted");
    localStorage.setItem("sugar_scanner_onboarding_v1", "completed");
  });
  const delivered: unknown[][] = [];
  await page.exposeFunction("recordMetaQA", (args: unknown[]) => delivered.push(args));
  await page.route("https://connect.facebook.net/**", async route => {
    expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("sugar-meta-purchase_")).length)).toBe(delivered.some(args => args[2] === "Purchase") ? 1 : 0);
    return route.fulfill({ contentType: "application/javascript", body: `
    for (const args of window.fbq.queue) window.recordMetaQA(args);
    window.fbq.queue = [];
    window.fbq.callMethod = (...args) => window.recordMetaQA(args);
  ` });
  });
  await page.route("**/api/billing/status", route => {
    const { sessionId } = route.request().postDataJSON();
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ active: true,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), ...(sessionId ? { purchase } : {}) }) });
  });
  await page.route("**/qa-checkout/private-session", route => route.fulfill({ contentType: "text/html",
    headers: { "Referrer-Policy": "unsafe-url" }, body: '<a href="/?checkout=success&session_id=cs_test_privatereturn">Return to scanner</a>' }));
  await page.goto("/qa-checkout/private-session");
  await page.getByRole("link", { name: "Return to scanner" }).click();
  await expect(page.getByText("Payment successful", { exact: true })).toBeVisible();
  await expect.poll(() => delivered.filter(args => args[2] === "Purchase").length).toBe(1);
  expect(await page.evaluate(() => document.referrer)).toBe("");
  await expect(page).toHaveURL(/\/$/);
  const event = delivered.find(args => args[2] === "Purchase");
  expect(event).toEqual(["trackSingle", process.env.META_PIXEL_ID, "Purchase", { value: 2.99, currency: "EUR" }, { eventID: purchase.eventId }]);
  await page.reload();
  await expect(page.getByText("7 days left", { exact: true })).toBeVisible();
  // Revisit the same verified return as well as reload: both must remain deduplicated.
  await page.goto("/api/billing/return?session_id=cs_test_privatereturn");
  await expect(page.getByText("Payment successful", { exact: true })).toBeVisible();
  await expect.poll(() => delivered.filter(args => args[2] === "PageView").length).toBeGreaterThanOrEqual(3);
  expect(delivered.filter(args => args[2] === "Purchase")).toHaveLength(1);
});
