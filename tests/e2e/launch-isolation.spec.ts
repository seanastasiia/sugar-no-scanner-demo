import { expect, test } from "@playwright/test";

test("launch entry flag hides the pilot without removing its separate demo", async ({ page }) => {
  const entryVisible = process.env.PERSONAL_SHELF_RANK_ENTRY_ENABLED !== "false";
  const evidenceRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/personal-shelf") evidenceRequests.push(request.url());
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException("QA denied", "NotAllowedError"); } }
    });
  });
  await page.goto("/?onboarding=1");
  await page.getByRole("button", { name: "Try a sample shelf", exact: true }).click();
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Best fit first", exact: true })).toBeVisible();
  await expect(page.getByRole("switch", { name: /Personal Shelf Rank/ })).toHaveCount(entryVisible ? 1 : 0);
  await page.getByRole("button", { name: "Rank 1, BAREBELLS Salty Peanut, Great fit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Salty Peanut", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to all results", exact: true }).click();
  await page.getByRole("button", { name: "Collapse product results", exact: true }).click();
  await expect(page.getByRole("button", { name: "Leave feedback", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Scan again", exact: true }).click();
  await page.getByRole("button", { name: "Show demo", exact: true }).click();
  await expect(page.getByRole("link", { name: /^New rating demo/ })).toHaveCount(entryVisible ? 1 : 0);
  await expect(page.getByRole("button", { name: /^Shelf demo/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Checkout demo/ })).toBeVisible();
  expect(evidenceRequests).toEqual([]);
  const demo = await page.goto("/demo/personal-shelf");
  expect(demo?.status()).toBe(200);
  await expect(page.getByText("64/100", { exact: true })).toBeVisible();
});
