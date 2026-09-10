import { expect, test } from "@playwright/test";

test.skip(!process.env.META_PIXEL_ID, "Meta must be enabled for its dedicated consent checks");

test("Meta stays blocked until consent and revokes without breaking onboarding", async ({ page }) => {
  const requests: string[] = [];
  await page.route("https://connect.facebook.net/**", route => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: "application/javascript", body: "/* SDK intentionally mocked, never send QA traffic to Meta */" });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "No thanks", exact: true })).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "No thanks", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ad privacy", exact: true })).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "Ad privacy", exact: true }).click();
  await page.getByRole("button", { name: "Allow Meta cookies", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  const queue = () => page.evaluate(() => (window as unknown as { fbq: { queue: unknown[][] } }).fbq.queue);
  expect((await queue()).filter(args => args[2] === "PageView")).toHaveLength(1);
  await page.getByRole("button", { name: "Ad privacy", exact: true }).click();
  await page.getByRole("button", { name: "No thanks", exact: true }).click();
  expect((await queue()).at(-1)).toEqual(["consent", "revoke"]);
  expect((await queue()).filter(args => String(args[0]).startsWith("track"))).toEqual([]);
  await page.reload();
  await expect(page.getByRole("button", { name: "Ad privacy", exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
});

test("Meta removes free text URLs before loading and keeps the consent card within a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.route("https://connect.facebook.net/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.goto("/?utm_content=private%40example.com#private");
  const card = page.getByRole("region", { name: "Help us measure our ads?" });
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: "test-results/meta-consent-320.png" });
  await page.getByRole("button", { name: "Allow Meta cookies", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll("#scanner-meta-pixel").length)).toBe(1);
});
