import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function unlock(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Live camera scanner")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show demo" })).toBeVisible();
}

async function expectInsideViewport(page: Page, locator: Locator) {
  const bounds = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.visualViewport?.width || window.innerWidth,
      viewportHeight: window.visualViewport?.height || window.innerHeight
    };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.top).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight + 1);
}

async function expectNoDocumentOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
  ).toBe(true);
}

async function expectOfficialSugarNoLogo(page: Page) {
  const logo = page.getByAltText("Sugar.no", { exact: true });
  await expect(logo).toHaveCount(1);
  await expect(logo).toBeVisible();
  const details = await logo.evaluate((element) => {
    const image = element as HTMLImageElement;
    const rect = image.getBoundingClientRect();
    return {
      pathname: new URL(image.currentSrc || image.src, window.location.href).pathname,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      ratio: rect.width / rect.height
    };
  });
  expect(details.pathname).toBe("/brand/sugar-no-logo-white.svg");
  expect(details.naturalWidth).toBeGreaterThan(0);
  expect(details.naturalHeight).toBeGreaterThan(0);
  expect(details.ratio).toBeCloseTo(137 / 26.07, 2);
  await expectInsideViewport(page, logo);
}

async function openDemoScene(page: Page, name: "Shelf demo" | "Checkout demo") {
  await page.getByRole("button", { name: "Show demo" }).click();
  const chooser = page.getByRole("dialog", { name: "See how a shelf scan works" });
  await expect(chooser).toBeVisible();
  await chooser.getByRole("button", { name: new RegExp(name) }).click();
}

async function waitForAlternativeImages(page: Page) {
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll<HTMLImageElement>('img[alt=""]')].filter((image) => {
      const url = new URL(image.currentSrc || image.src, window.location.href);
      const optimizedSource = url.searchParams.get("url");
      return !optimizedSource?.startsWith("http");
    });
    return images.every((image) => image.complete && image.naturalWidth > 0);
  });
}

async function mockAlternativeOffers(page: Page, price = 1.49) {
  await page.route("**/api/offers", async (route) => {
    const { slugs } = route.request().postDataJSON() as { slugs: string[] };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        offers: Object.fromEntries(slugs.map((slug) => [slug, {
          retailer: "Barbora",
          slug,
          title: slug,
          brand: "Test brand",
          url: `https://barbora.lv/produkti/${slug}`,
          price,
          currency: "EUR",
          unitPrice: null,
          unit: null,
          imageUrl: null,
          checkedAt: "2026-08-26T10:00:00.000Z",
          matchConfidence: 1,
          exactSku: true
        }]))
      })
    });
  });
}

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

async function chooseSavedPhoto(page: Page, name = "qa-shelf.png") {
  const showDemo = page.getByRole("button", { name: "Show demo" });
  await showDemo.click();
  const chooser = page.getByRole("dialog", { name: "See how a shelf scan works" });
  await page.waitForTimeout(150);
  if (!(await chooser.isVisible())) await showDemo.click();
  await expect(chooser).toBeVisible({ timeout: 10_000 });
  await chooser.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "image/png",
    buffer: onePixelPng
  });
}

async function chooseLandscapeSavedPhoto(page: Page, name = "qa-landscape-shelf.jpg") {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.fillStyle = "#193b5a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#f4d35e";
    context.fillRect(80, 80, 260, 420);
    context.fillRect(450, 80, 260, 420);
    return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
  });
  await page.getByRole("button", { name: "Show demo" }).click();
  const chooser = page.getByRole("dialog", { name: "See how a shelf scan works" });
  await expect(chooser).toBeVisible();
  await chooser.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "image/jpeg",
    buffer: Buffer.from(base64, "base64")
  });
}

async function chooseLongPortraitSavedPhoto(page: Page, name = "qa-online-store-page.jpg") {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 2000;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.fillStyle = "#f4f0e7";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 3; index += 1) {
      context.fillStyle = index % 2 ? "#d9ecf2" : "#f7d9cf";
      context.fillRect(80, 120 + index * 620, 740, 480);
      context.fillStyle = "#202020";
      context.font = "42px sans-serif";
      context.fillText(`Product card ${index + 1}`, 160, 220 + index * 620);
    }
    return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
  });
  await page.getByRole("button", { name: "Show demo" }).click();
  const chooser = page.getByRole("dialog", { name: "See how a shelf scan works" });
  await expect(chooser).toBeVisible();
  await chooser.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "image/jpeg",
    buffer: Buffer.from(base64, "base64")
  });
}

function ratedInlineProduct(input: {
  id: string;
  brand: string;
  name: string;
  score: number;
  protein: number;
  sugar: number;
}) {
  return {
    id: input.id,
    retailerProductId: input.id.replace(/^barbora:/, ""),
    brand: input.brand,
    name: input.name,
    shortName: input.name,
    aliases: [],
    format: "other",
    category: "Grocery",
    packSizeG: 100,
    nutritionBasis: "100g",
    energyKcalPer100: 120,
    gtin: null,
    nutrientsPer100g: { proteinG: input.protein, fiberG: null, totalSugarG: input.sugar },
    noAddedSugarClaim: false,
    imageUrl: null,
    retailerUrl: `https://barbora.lv/produkti/${input.id.replace(/^barbora:/, "")}`,
    sources: [
      {
        label: "Barbora Latvia",
        url: `https://barbora.lv/produkti/${input.id.replace(/^barbora:/, "")}`,
        checkedAt: "2026-08-25T00:00:00.000Z",
        fields: ["identity", "protein", "totalSugar"],
        status: "verified"
      }
    ],
    isGolden: false,
    accent: "coral",
    matchScore: input.score,
    matchReason: "complete",
    ratingBasis: "barbora_reference",
    ratingStatus: "complete",
    ratingSignalCount: 2,
    ratingSignalMask: ["protein", "inverseSugar"],
    criterionScores: { protein: input.score, inverseSugar: input.score }
  };
}

async function mockLiveCamera(page: Page) {
  await page.addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 960;
    const context = canvas.getContext("2d");
    context?.fillRect(0, 0, canvas.width, canvas.height);
    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<typeof originalDrawImage>
    ) {
      if (args[0] instanceof HTMLVideoElement) return;
      return originalDrawImage.apply(this, args);
    } as typeof originalDrawImage;
    HTMLMediaElement.prototype.play = async function (this: HTMLMediaElement) {
      if (this instanceof HTMLVideoElement) {
        Object.defineProperties(this, {
          readyState: { configurable: true, get: () => 4 },
          videoWidth: { configurable: true, get: () => 640 },
          videoHeight: { configurable: true, get: () => 960 }
        });
      }
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => canvas.captureStream(5) }
    });
  });
}

test("public root opens directly into the camera-first experience", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => Promise.reject(new DOMException("Denied in test", "NotAllowedError")) }
    });
  });
  await unlock(page);
  await expectOfficialSugarNoLogo(page);
  await expect(page.getByText("Camera permission is off")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable camera" })).toBeVisible();
  await expect(page.getByTestId("scan-guide")).toHaveCount(0);
  await page.goto("/access");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("Investor access code")).toHaveCount(0);
  await expect(page.getByText("Private demo", { exact: true })).toHaveCount(0);
});

test("scanner follows the current Sugar.no app surface language without changing fit semantics", async ({ page }) => {
  await unlock(page);
  const palette = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      ["--canvas", "--surface", "--surface-tinted", "--ink", "--muted", "--accent", "--border", "--focus"]
        .map((token) => [token, style.getPropertyValue(token).trim()])
    );
  });
  expect(palette).toEqual({
    "--canvas": "#f3f4f8",
    "--surface": "#fff",
    "--surface-tinted": "#f5f5f7",
    "--ink": "#11131f",
    "--muted": "#69696f",
    "--accent": "#0a84ff",
    "--border": "#e8e9ef",
    "--focus": "#0a84ff"
  });

  await openDemoScene(page, "Shelf demo");
  await expect(page.locator("aside")).toHaveCSS("background-color", "rgb(243, 244, 248)");
  await expect(page.getByTestId("stage-status-pill")).toHaveCount(0);
  const markers = page.getByLabel("Shelf photo scanner").locator('button[aria-label^="Open "]');
  await expect(markers).toHaveCount(4);
  await expect(markers.filter({ hasText: "Great fit" })).toHaveCount(2);
  await expect(markers.filter({ hasText: "Moderate fit" })).toHaveCount(2);
});

test("sample shelf photo highlights products and ranks two-factor Sugar.no fits", async ({ page }) => {
  await mockAlternativeOffers(page);
  await unlock(page);
  await openDemoScene(page, "Shelf demo");
  await expect(page.getByRole("status")).toContainText("4 products · 4 with Sugar.no fit");
  await expect(page.getByTestId("stage-status-pill")).toHaveCount(0);
  const shelfPreview = page.getByLabel("Product result preview");
  await expect(shelfPreview.getByText(/^#[1-4]$/)).toHaveCount(4);
  await expect(shelfPreview.getByText(/^Sugar \d+(?:\.\d+)?g$/)).toHaveCount(4);
  await expect(shelfPreview.getByRole("button").first()).toHaveAccessibleName(/^Rank 1,.*Sugar .* grams per 100 grams$/);
  const shelfDeal = shelfPreview.getByLabel("Demo shelf price €3.49, Barbora €2.79, cheaper at Barbora");
  await expect(shelfDeal).toBeVisible();
  await expect(shelfDeal.getByText("€3.49", { exact: true })).toHaveCSS("text-decoration-line", "line-through");
  const shelfBuy = shelfPreview.getByRole("link", { name: /Buy .* cheaper at Barbora for €2\.79/ });
  await expect(shelfBuy).toBeVisible();
  await expect(shelfBuy).toHaveAttribute(
    "href",
    "https://barbora.lv/produkti/prot-bat-sal-riekst-saldin-barebells-55-g"
  );
  expect((await shelfBuy.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByLabel("Shelf photo scanner").locator('button[aria-label^="Open "]')).toHaveCount(4);
  await expect(page.getByRole("status")).toContainText("4 products · 4 with Sugar.no fit");
  await expect(page.getByLabel("Sample shelf photo with four supported protein snacks").locator("img")).toHaveCount(1);
  await expect(page.getByAltText("Four protein bars on a supermarket shelf")).toBeVisible();
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLImageElement>('div[aria-label="Sample shelf photo with four supported protein snacks"] img')]
      .every((image) => image.complete && image.naturalWidth > 0)
  );
  const shelfOverlay = page.getByLabel("Shelf photo scanner");
  await expect(shelfOverlay.getByText("2/2 signals", { exact: true })).toHaveCount(0);
  const bestMarker = shelfOverlay.locator('button[aria-label*="best in this scan"]').first();
  const bestChrome = await bestMarker.evaluate((element) => {
    const style = getComputedStyle(element);
    return { borderColor: style.borderColor, boxShadow: style.boxShadow };
  });
  expect(bestChrome.borderColor).not.toBe("rgb(255, 255, 255)");
  expect(bestChrome.boxShadow).not.toContain("rgb(255, 255, 255)");
  const markerDiscs = shelfOverlay.locator('button[aria-label^="Open "] > span');
  await expect(markerDiscs).toHaveCount(4);
  const markerDiscSizes = await markerDiscs.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return `${Math.round(box.width)}x${Math.round(box.height)}`;
    })
  );
  expect(markerDiscSizes).toEqual(["46x46", "46x46", "46x46", "46x46"]);
  const moderateMarker = shelfOverlay.locator('button[aria-label*="Moderate fit"]').first();
  await moderateMarker.click();
  const selectedChrome = await moderateMarker.evaluate((element) => {
    const style = getComputedStyle(element);
    return { borderColor: style.borderColor, boxShadow: style.boxShadow };
  });
  expect(selectedChrome.borderColor).not.toBe("rgb(255, 255, 255)");
  expect(selectedChrome.boxShadow).not.toContain("rgb(255, 255, 255)");
  await bestMarker.click();
  await waitForAlternativeImages(page);
  await expect(page.getByRole("button", { name: "Scan again" })).toHaveCount(0);
  await page.screenshot({ path: "docs/screenshots/shelf-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "View all", exact: true }).click();
  const resultsDialog = page.getByRole("dialog", { name: "Products from this scan" });
  await expect(resultsDialog).toBeVisible();
  const ranking = resultsDialog.getByLabel("Products ranked by Sugar.no fit");
  await expect(ranking).toBeVisible();
  await expect(ranking.getByRole("button")).toHaveCount(4);
  await expect(ranking.getByRole("button").first()).toHaveAccessibleName(/^Rank 1,/);
  await expect(resultsDialog.getByRole("heading", { name: "Best fit first" })).toBeVisible();
  await expect(resultsDialog.getByText("Full comparison", { exact: true })).toHaveCount(0);
  await expect(resultsDialog.getByText("Sugar.no ranking", { exact: true })).toHaveCount(0);
  await expect(resultsDialog.getByText("Based on source-backed protein and total sugar", { exact: true })).toHaveCount(0);
  await expect(resultsDialog.getByText("4 of 4 ready to compare", { exact: true })).toHaveCount(0);
  await expect(resultsDialog.getByText("4/4 rated", { exact: true })).toHaveCount(0);
  await expect(resultsDialog.getByRole("button", { name: "Scan again" })).toHaveCount(0);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  await expect.poll(async () => (await resultsDialog.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(viewportHeight * 0.95);
  await expect(page.getByText("Best fit in this scan", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "docs/screenshots/shelf-results-mobile.png" });
  await expect(resultsDialog.getByLabel("Sugar.no badge")).toHaveCount(0);
  await expect(resultsDialog.getByText("Similar options", { exact: true })).toBeVisible();
  const similarOptions = resultsDialog.getByRole("region", { name: "Compare without starting over" });
  await expect(similarOptions.getByRole("link", { name: /Buy online .* for €1\.49/ })).toHaveCount(2);
  await expect(page.getByText("View at Barbora · check current price", { exact: true })).toHaveCount(0);
  await ranking.getByRole("button", { name: /BAREBELLS.*Lemon Cheesecake/i }).click();
  const cheaperAlternative = similarOptions.getByRole("link", { name: /Buy cheaper online .* for €1\.49/ });
  await expect(cheaperAlternative).toBeVisible();
  await expect(cheaperAlternative.getByText("€3.49 shelf", { exact: true })).toHaveCSS(
    "text-decoration-line",
    "line-through"
  );
  await ranking.getByRole("button").first().click();
  await expect(page.getByLabel("Price comparison")).toHaveCount(0);
  const rankedShelfDeal = ranking.getByRole("link", { name: /cheaper at Barbora for €2\.79/i });
  await expect(rankedShelfDeal).toBeVisible();
  await expect(rankedShelfDeal.getByText("€3.49", { exact: true })).toHaveCSS(
    "text-decoration-line",
    "line-through"
  );
  await expect(rankedShelfDeal.getByText("€2.79", { exact: true })).toBeVisible();
  await expect(rankedShelfDeal).toHaveAttribute(
    "href",
    "https://barbora.lv/produkti/prot-bat-sal-riekst-saldin-barebells-55-g"
  );
  expect((await rankedShelfDeal.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByLabel("Shelf marker legend")).toHaveCount(0);
  await expect(page.getByText("Outlines show products with both protein and total sugar available.", { exact: true })).toHaveCount(0);
  await expect(ranking.getByText(/Protein \d+(?:\.\d+)?g · Sugar \d+(?:\.\d+)?g/).first()).toBeVisible();
  await expect(page.getByText(/Sugar\.no Match \d+/)).toHaveCount(0);
  await expect(page.getByText("Data sources and limits", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/\b(good|bad|unhealthy)\b/i)).toHaveCount(0);
  await waitForAlternativeImages(page);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("checkout photo recognizes and rates three products on the belt", async ({ page }) => {
  await unlock(page);
  await openDemoScene(page, "Checkout demo");
  await expect(page.getByRole("status")).toContainText("3 products · 3 with Sugar.no fit");
  await expect(page.getByTestId("stage-status-pill")).toHaveCount(0);
  const checkoutPreview = page.getByLabel("Product result preview");
  await expect(checkoutPreview.locator("img")).toHaveCount(3);
  await expect.poll(async () =>
    checkoutPreview.locator("img").evaluateAll((images) =>
      images.every((image) => {
        const productImage = image as HTMLImageElement;
        if (!productImage.complete || productImage.naturalWidth === 0) return false;
        const canvas = document.createElement("canvas");
        canvas.width = productImage.naturalWidth;
        canvas.height = productImage.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) return false;
        context.drawImage(productImage, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let min = 255;
        let max = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const brightness = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
          min = Math.min(min, brightness);
          max = Math.max(max, brightness);
        }
        return max - min > 20;
      })
    )
  ).toBe(true);
  const checkoutMarkers = page.getByLabel("Checkout photo scanner").locator('button[aria-label^="Open "]');
  await expect(checkoutMarkers).toHaveCount(3);
  await expect(checkoutMarkers.filter({ hasText: "Great fit" })).toHaveCount(2);
  await expect(checkoutMarkers.filter({ hasText: "Moderate fit" })).toHaveCount(1);
  await expect(page.getByText("3 rated · Best fit first", { exact: true })).toBeVisible();
  await expect(page.getByAltText("Groceries on a real supermarket checkout conveyor belt")).toBeVisible();
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLImageElement>('div[aria-label="Real supermarket checkout belt sample with three recognized packaged products"] img')]
      .every((image) => image.complete && image.naturalWidth > 0)
  );
  await page.screenshot({ path: "docs/screenshots/checkout-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "View all", exact: true }).click();
  const ranking = page.getByLabel("Products ranked by Sugar.no fit");
  await expect(ranking).toBeVisible({ timeout: 8_000 });
  await expect(ranking.getByRole("button")).toHaveCount(3);
  await expect(ranking.locator("img")).toHaveCount(3);
  await expect.poll(async () =>
    ranking.locator("img").evaluateAll((images) =>
      images.every((image) => {
        const productImage = image as HTMLImageElement;
        if (!productImage.complete || productImage.naturalWidth === 0) return false;
        const canvas = document.createElement("canvas");
        canvas.width = productImage.naturalWidth;
        canvas.height = productImage.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) return false;
        context.drawImage(productImage, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let min = 255;
        let max = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const brightness = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
          min = Math.min(min, brightness);
          max = Math.max(max, brightness);
        }
        return max - min > 20;
      })
    )
  ).toBe(true);
  await expect(ranking.getByText("SPROUD", { exact: true })).toBeVisible();
  await expect(ranking.getByText("SCHNITZER", { exact: true })).toBeVisible();
  await expect(ranking.getByText("STOCKMANN", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Best fit first" })).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "docs/screenshots/checkout-results-mobile.png" });
  await expect(page.getByText("Best fit in this scan", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Sugar.no badge")).toHaveCount(0);
  await expect(ranking.getByText(/Protein \d+(?:\.\d+)?g · Sugar \d+(?:\.\d+)?g/)).toHaveCount(3);
  await expect(page.getByText("Needs nutrition label", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Scan nutrition label" })).toHaveCount(0);
  await ranking.getByRole("button", { name: /STOCKMANN Fresh chanterelles/ }).click();
  await expect(page.getByText("Compare without starting over")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /save/i })).toHaveCount(0);
});

test("checkout demo cancels an in-flight live-camera read before showing deterministic results", async ({ page }) => {
  await mockLiveCamera(page);
  let cameraRequests = 0;
  await page.route("**/api/recognize", async (route) => {
    const body = route.request().postDataJSON() as { source?: string };
    if (body.source !== "camera") {
      await route.continue();
      return;
    }
    cameraRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    try {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          requestId: "stale-live-camera-read",
          status: "not_sure",
          latencyMs: 1_500,
          model: "qa-delayed-camera",
          imageStored: false,
          detections: []
        })
      });
    } catch {
      // The corrected flow aborts this stale request when the demo source is selected.
    }
  });

  await unlock(page);
  await expect.poll(() => cameraRequests, { timeout: 8_000 }).toBeGreaterThan(0);
  await openDemoScene(page, "Checkout demo");
  await expect(page.getByRole("status")).toContainText("3 products · 3 with Sugar.no fit", { timeout: 8_000 });
  await page.waitForTimeout(1_800);
  await expect(page.getByRole("status")).toContainText("3 products · 3 with Sugar.no fit");
  await expect(page.getByText("Trying a closer center read…", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Checkout photo scanner").locator('button[aria-label^="Open "]')).toHaveCount(3);
});

test("demo chooser supports shelf, checkout and a clear return to live camera", async ({ page }) => {
  await unlock(page);
  await page.getByRole("button", { name: "Show demo" }).click();
  await expect(page.getByText("Investor test aisles", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "See how a shelf scan works" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Shelf demo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Checkout demo" })).toBeVisible();
  await page.getByRole("button", { name: "Shelf demo" }).click();
  await expect(page.getByRole("status")).toContainText("4 products · 4 with Sugar.no fit");
  await page.getByRole("button", { name: "Back to live camera" }).click();
  await expect(page.getByLabel("Live camera scanner")).toBeVisible();
  await openDemoScene(page, "Checkout demo");
  await expect(page.getByRole("status")).toContainText("3 products · 3 with Sugar.no fit");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Best fit first" })).toBeVisible();
  await expect(page.getByRole("button", { name: /save/i })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Saved options" })).toHaveCount(0);
  await page.getByRole("button", { name: "Collapse product results" }).click();
  await expect(page.getByRole("button", { name: "Back to live camera" })).toBeVisible();
});

test("comparison remains usable with reduced motion, dark mode and enlarged text", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "sugarno.saved-products.v1",
      JSON.stringify(["prot-bat-sal-riekst-saldin-barebells-55-g"])
    );
    document.documentElement.style.fontSize = "125%";
  });
  await unlock(page);
  await expect(page.getByRole("heading", { name: "Saved options" })).toHaveCount(0);
  await openDemoScene(page, "Shelf demo");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByLabel("Products ranked by Sugar.no fit")).toBeVisible();
  await expect(page.getByRole("button", { name: /save/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("scanner remains operable at narrow portrait and phone landscape sizes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await unlock(page);
  await expectOfficialSugarNoLogo(page);
  await openDemoScene(page, "Shelf demo");
  const portraitStage = page.getByLabel("Shelf photo scanner").locator(":scope > div").first();
  const portraitStageBox = await portraitStage.boundingBox();
  expect(portraitStageBox?.height).toBeGreaterThanOrEqual(812 * 0.95);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByLabel("Products ranked by Sugar.no fit")).toBeVisible();
  await expect(page.getByRole("button", { name: "Collapse product results" })).toHaveCount(1);
  await expect(page.locator('[role="dialog"] svg.lucide-chevron-down')).toHaveCount(1);
  await expect(page.locator('[role="dialog"] svg.lucide-chevron-up')).toHaveCount(0);

  await page.setViewportSize({ width: 812, height: 375 });
  await expectOfficialSugarNoLogo(page);
  await expect(page.getByLabel("Products ranked by Sugar.no fit")).toBeVisible();
  await page.getByRole("button", { name: "Collapse product results" }).click();
  await expect(page.getByRole("button", { name: "Back to live camera" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("camera and results fit iPhone 17 Pro and adjacent iPhone viewports", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await unlock(page);
  await expectOfficialSugarNoLogo(page);
  await openDemoScene(page, "Shelf demo");
  await expect(page.getByRole("status")).toContainText("4 products · 4 with Sugar.no fit");

  const sheet = page.locator("aside");
  const viewAll = page.getByRole("button", { name: "View all", exact: true });

  await expectInsideViewport(page, sheet);
  await expect(page.getByTestId("stage-status-pill")).toHaveCount(0);
  await expectInsideViewport(page, viewAll);
  expect((await viewAll.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole("button", { name: "Scan again" })).toHaveCount(0);
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: "docs/screenshots/iphone-17-pro-camera.png" });

  await viewAll.click();
  const dialog = page.getByRole("dialog", { name: "Products from this scan" });
  await expectInsideViewport(page, dialog);
  await expect(page.getByRole("button", { name: "Return to camera" })).toHaveCount(0);
  await expectInsideViewport(page, page.getByRole("button", { name: "Collapse product results" }));
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: "docs/screenshots/iphone-17-pro-results.png" });

  const viewports = [
    { width: 440, height: 956, label: "large portrait" },
    { width: 375, height: 667, label: "small portrait" },
    { width: 874, height: 402, label: "iPhone 17 Pro landscape" }
  ];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expectOfficialSugarNoLogo(page);
    await expectInsideViewport(page, dialog);
    await expectInsideViewport(page, page.getByRole("button", { name: "Collapse product results" }));
    await expectNoDocumentOverflow(page);
    await page.getByRole("button", { name: "Collapse product results" }).click();
    await expectInsideViewport(page, sheet);
    await expect(page.getByTestId("stage-status-pill")).toHaveCount(0);
    await expectInsideViewport(page, page.getByRole("button", { name: "View all", exact: true }));
    await expect(page.getByRole("button", { name: "Scan again" })).toHaveCount(0);
    await expectNoDocumentOverflow(page);
    if (viewport.label === "iPhone 17 Pro landscape") {
      await page.screenshot({ path: "docs/screenshots/iphone-17-pro-landscape.png" });
    }
    await page.getByRole("button", { name: "View all", exact: true }).click();
  }
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

  const productEvent = await page.request.post("/api/events", {
    data: {
      sessionId: crypto.randomUUID(),
      name: "alternative_viewed",
      source: "sample-conveyor",
      productId: "demo-product",
      metadata: { placement: "result" }
    }
  });
  expect(productEvent.ok()).toBe(true);
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
  await expect(page.getByText("Camera permission is off")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable camera" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show demo" })).toBeVisible();
});

test("saved images are resized client-side and fail closed without a provider key", async ({ page }) => {
  await unlock(page);
  await chooseSavedPhoto(page, "unknown.png");
  await expect(page.getByRole("status")).toContainText("Recognition is unavailable");
  await expect(page.getByRole("dialog", { name: "Products from this scan" })).toHaveCount(0);
  await expect(page.getByLabel("Saved shelf or checkout photo scanner")).toBeVisible();
  await expect(page.getByText("Saved shelf or checkout photo", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Back to live camera" })).toBeVisible();
});

test("a landscape saved shelf is scanned as a full frame plus three row close-ups", async ({ page }) => {
  const exactId = "prot-bat-sal-riekst-saldin-barebells-55-g";
  let recognitionRequests = 0;
  await page.route("**/api/recognize", async (route) => {
    recognitionRequests += 1;
    const detections = recognitionRequests === 1
      ? [{
          productId: "visual:barebells-protein-bar",
          catalogProductId: null,
          confidence: 0.89,
          box: { x: 0.1, y: 0.08, width: 0.8, height: 0.42 },
          observedText: "Barebells protein bar",
          identity: {
            brand: "Barebells",
            name: "Barebells protein bar",
            variant: null,
            packSize: null,
            category: null,
            matchKind: "visual_only"
          },
          shelfPrice: null,
          retailerOffer: null
        }]
      : recognitionRequests === 2
        ? [{
            productId: exactId,
            catalogProductId: exactId,
            confidence: 0.97,
            box: { x: 0.2, y: 0.16, width: 0.32, height: 0.56 },
            observedText: "Barebells Salty Peanut 55g",
            identity: {
              brand: "Barebells",
              name: "Barebells Salty Peanut 55g",
              variant: "Salty Peanut",
              packSize: "55g",
              category: "protein bar",
              matchKind: "verified_catalog"
            },
            shelfPrice: null,
            retailerOffer: null
          }]
        : [];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: `landscape-pass-${recognitionRequests}`,
        status: detections.length ? "matched" : "not_sure",
        latencyMs: 300,
        model: "qa-mock",
        imageStored: false,
        detections
      })
    });
  });
  await unlock(page);
  await chooseLandscapeSavedPhoto(page);
  await expect(page.getByRole("status")).toContainText("1 product · 1 with Sugar.no fit", { timeout: 10_000 });
  expect(recognitionRequests).toBe(4);
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("heading", { name: /BAREBELLS/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Barebells protein bar/ })).toHaveCount(0);
});

test("a long online-store screenshot is scanned in four passes and opens one merged product list", async ({ page }) => {
  const baltaisId = "barbora:biezp-krems-protein-baltais-persiku-300-g";
  const stracciatellaId = "barbora:proteina-biezp-krems-vanil-baltais-200-g";
  const junglePopId = "barbora:zeleja-jungle-pop-kivi-115-g";
  const products = {
    [baltaisId]: ratedInlineProduct({
      id: baltaisId,
      brand: "BALTAIS",
      name: "Protein Fit peach 300g",
      score: 91,
      protein: 10,
      sugar: 4
    }),
    [stracciatellaId]: ratedInlineProduct({
      id: stracciatellaId,
      brand: "BALTAIS",
      name: "Protein Fit Stracciatella 200g",
      score: 84,
      protein: 12,
      sugar: 5
    }),
    [junglePopId]: ratedInlineProduct({
      id: junglePopId,
      brand: "JUNGLE POP",
      name: "Kiwi jelly 115g",
      score: 40,
      protein: 0,
      sugar: 14
    })
  };
  let recognitionRequests = 0;
  await page.route("**/api/recognize", async (route) => {
    recognitionRequests += 1;
    const id = recognitionRequests <= 2
      ? baltaisId
      : recognitionRequests === 3
        ? stracciatellaId
        : junglePopId;
    const product = products[id];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: `portrait-pass-${recognitionRequests}`,
        status: "matched",
        latencyMs: 350,
        model: "qa-mock",
        imageStored: false,
        detections: [
          {
            productId: id,
            catalogProductId: id,
            confidence: recognitionRequests === 1 ? 0.94 : 0.97,
            box: { x: 0.12, y: 0.12, width: 0.76, height: 0.26 },
            observedText: `${product.brand} ${product.name}`,
            identity: {
              brand: product.brand,
              name: product.name,
              variant: null,
              packSize: null,
              category: "Grocery",
              matchKind: "barbora"
            },
            shelfPrice: null,
            retailerOffer: null,
            inlineProduct: product
          }
        ]
      })
    });
  });
  await unlock(page);
  await chooseLongPortraitSavedPhoto(page);
  const resultsDialog = page.getByRole("dialog", { name: "Products from this scan" });
  await expect(resultsDialog).toBeVisible({ timeout: 10_000 });
  expect(recognitionRequests).toBe(4);
  const ranking = resultsDialog.getByLabel("Products ranked by Sugar.no fit");
  await expect(ranking.getByRole("button")).toHaveCount(3);
  await expect(ranking.getByRole("button", { name: /BALTAIS Protein Fit peach 300g/ })).toHaveCount(1);
  await expect(ranking.getByRole("button", { name: /BALTAIS Protein Fit Stracciatella 200g/ })).toHaveCount(1);
  await expect(ranking.getByRole("button", { name: /JUNGLE POP Kiwi jelly 115g/ })).toHaveCount(1);
  await expect(page.getByTestId("scan-guide")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Best fit first" })).toBeVisible();
});

test("one-signal, identity-only and price-only products disappear after lookup", async ({ page }) => {
  const limitedId = "barbora:qa-protein-only";
  const identityId = "barbora:qa-identity-only";
  await page.route("**/api/recognize", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "limited-and-identity",
        status: "matched",
        latencyMs: 800,
        model: "qa-mock",
        imageStored: false,
        detections: [limitedId, identityId].map((productId, index) => ({
          productId,
          catalogProductId: productId,
          confidence: 0.96,
          box: { x: 0.08 + index * 0.5, y: 0.2, width: 0.38, height: 0.55 },
          observedText: index === 0 ? "QA protein only" : "QA identity only",
          identity: {
            brand: "QA",
            name: index === 0 ? "QA protein only" : "QA identity only",
            variant: null,
            packSize: "100 g",
            category: "Snack",
            matchKind: "barbora"
          },
          shelfPrice: index === 1
            ? { amount: 0.69, currency: "EUR", observedText: "0 69", confidence: 0.96 }
            : null,
          retailerOffer: null
        }))
      })
    });
  });
  await page.route("**/api/resolve-products", async (route) => {
    const { detections } = route.request().postDataJSON() as { detections: unknown[] };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ detections, latencyMs: 1, imageStored: false })
    });
  });
  await page.route("**/api/products/**", async (route) => {
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1) || "");
    const limited = id === limitedId;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        product: {
          id,
          retailerProductId: id.slice("barbora:".length),
          brand: "QA",
          name: limited ? "QA protein only" : "QA identity only",
          shortName: limited ? "QA protein only" : "QA identity only",
          aliases: [],
          format: "other",
          packSizeG: 100,
          nutritionBasis: "100g",
          energyKcalPer100: limited ? 300 : null,
          gtin: null,
          nutrientsPer100g: { proteinG: limited ? 24 : null, fiberG: null, totalSugarG: null },
          noAddedSugarClaim: false,
          imageUrl: null,
          retailerUrl: `https://barbora.lv/produkti/${id.slice("barbora:".length)}`,
          sources: [],
          isGolden: false,
          accent: "coral",
          matchScore: null,
          matchReason: limited ? "limited_nutrition" : "missing_nutrition",
          ratingBasis: limited ? "barbora_reference_partial" : null,
          ratingStatus: limited ? "limited_signal" : "identity_only",
          ratingSignalCount: limited ? 1 : 0,
          ratingSignalMask: limited ? ["protein"] : [],
          criterionScores: limited ? { protein: 100, inverseSugar: null } : null
        },
        alternatives: []
      })
    });
  });

  await unlock(page);
  await chooseSavedPhoto(page, "limited-and-identity.png");
  await expect(page.getByRole("status")).toContainText("No products with verified Sugar.no fit found", { timeout: 10_000 });
  await expect(page.getByRole("dialog", { name: "Products from this scan" })).toHaveCount(0);
  await expect(page.getByTestId("rated-detection-marker")).toHaveCount(0);
  await expect(page.getByLabel("Shelf marker legend")).toHaveCount(0);
  await expect(page.getByText("€0.69", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Nutrition not verified online", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Best fit in this scan", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Scan nutrition label" })).toHaveCount(0);
});

test("an unrated package can receive a Sugar.no fit from automatic online enrichment", async ({ page }) => {
  await mockLiveCamera(page);
  await page.route("**/api/recognize", async (route) => {
    const visual = (id: string, name: string, x: number) => ({
      productId: id,
      catalogProductId: null,
      confidence: 0.96,
      box: { x, y: 0.2, width: 0.36, height: 0.56 },
      observedText: name,
      identity: {
        brand: id.includes("sproud") ? "Sproud" : "Other",
        name,
        variant: null,
        packSize: id.includes("sproud") ? "1 L" : "50 g",
        category: null,
        matchKind: "visual_only"
      },
      shelfPrice: null,
      retailerOffer: null
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "visual-products",
        status: "matched",
        latencyMs: 600,
        model: "qa-mock",
        imageStored: false,
        detections: [
          visual("visual:sproud-barista", "Sproud Barista 1L", 0.08),
          visual("visual:other-snack", "Other Snack", 0.56)
        ]
      })
    });
  });

  await page.route("**/api/resolve-products", async (route) => {
    const { detections } = route.request().postDataJSON() as { detections: Array<Record<string, unknown>> };
    const sproud = detections[0];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        latencyMs: 700,
        imageStored: false,
        detections: [
          {
            ...sproud,
            productId: "web:sproud-barista-1l",
            identity: { ...(sproud.identity as object), matchKind: "web_search" },
            nutritionLinkConfidence: 0.96,
            inlineProduct: {
              id: "web:sproud-barista-1l",
              retailerProductId: "web:sproud-barista-1l",
              brand: "Sproud",
              name: "Sproud Barista 1L",
              shortName: "Sproud Barista 1L",
              aliases: [],
              format: "other",
              category: "plant drink",
              packSizeG: 1000,
              nutritionBasis: "100ml",
              energyKcalPer100: 40,
              gtin: null,
              nutrientsPer100g: { proteinG: 2.1, fiberG: null, totalSugarG: 1.8 },
              noAddedSugarClaim: false,
              imageUrl: null,
              retailerUrl: "https://example.com/sproud",
              sources: [{
                label: "Web nutrition source · Manufacturer",
                url: "https://example.com/sproud",
                checkedAt: "2026-08-25T00:00:00.000Z",
                fields: ["identity", "protein", "totalSugar"],
                status: "secondary"
              }],
              isGolden: false,
              accent: "coral",
              matchScore: 100,
              matchReason: "complete",
              ratingBasis: "web_search_reference",
              ratingStatus: "complete",
              ratingSignalCount: 2,
              ratingSignalMask: ["protein", "inverseSugar"],
              criterionScores: { protein: 100, inverseSugar: 100 }
            }
          },
          detections[1]
        ]
      })
    });
  });

  await unlock(page);
  await expect(page.getByRole("status")).toContainText("1 product · 1 with Sugar.no fit", { timeout: 8_000 });
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByText("1 of 2 ready to compare", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Best fit first" })).toHaveCount(0);
  await expect(page.getByText("Other Snack", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Sproud Barista 1L/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan nutrition label" })).toHaveCount(0);
  await expect(page.getByLabel("Sugar.no badge")).toBeVisible();
});

test("a broad live shelf scan keeps up to ten different Sugar.no-rated products in one result", async ({ page }) => {
  await mockLiveCamera(page);

  let recognitionAttempts = 0;
  const focusModes: boolean[] = [];
  await page.route("**/api/recognize", async (route) => {
    const request = route.request().postDataJSON() as { focusMode?: boolean };
    recognitionAttempts += 1;
    focusModes.push(Boolean(request.focusMode));
    const detections = [
      {
        productId: "prot-bat-sal-riekst-saldin-barebells-55-g",
        catalogProductId: "prot-bat-sal-riekst-saldin-barebells-55-g",
        confidence: 0.97,
        box: { x: 0.06, y: 0.22, width: 0.25, height: 0.48 },
        observedText: "Barebells Salty Peanut"
      },
      {
        productId: "prot-bat-barebells-lemon-cheesecake-55-g",
        catalogProductId: "prot-bat-barebells-lemon-cheesecake-55-g",
        confidence: 0.95,
        box: { x: 0.37, y: 0.2, width: 0.25, height: 0.5 },
        observedText: "Barebells Lemon Cheesecake"
      },
      {
        productId: "proteina-bat-cepuma-garsa-iconfit-55-g",
        catalogProductId: "proteina-bat-cepuma-garsa-iconfit-55-g",
        confidence: 0.93,
        box: { x: 0.68, y: 0.23, width: 0.25, height: 0.47 },
        observedText: "ICONFIT Cookie Bliss"
      },
      {
        productId: "prot-batonins-go-on-kakao-sokolade-50-g",
        catalogProductId: "prot-batonins-go-on-kakao-sokolade-50-g",
        confidence: 0.92,
        box: { x: 0.03, y: 0.62, width: 0.15, height: 0.24 },
        observedText: "GO ON Cocoa"
      },
      {
        productId: "prot-baton-ar-dzerven-un-godzi-go-on-50-g",
        catalogProductId: "prot-baton-ar-dzerven-un-godzi-go-on-50-g",
        confidence: 0.91,
        box: { x: 0.22, y: 0.62, width: 0.15, height: 0.24 },
        observedText: "GO ON Cranberry"
      },
      {
        productId: "prot-bat-zemesr-maz-cukura-snickers-57-g",
        catalogProductId: "prot-bat-zemesr-maz-cukura-snickers-57-g",
        confidence: 0.9,
        box: { x: 0.41, y: 0.62, width: 0.15, height: 0.24 },
        observedText: "SNICKERS Protein"
      },
      {
        productId: "prot-bat-zemesriekstu-karameli-go-on-50-g",
        catalogProductId: "prot-bat-zemesriekstu-karameli-go-on-50-g",
        confidence: 0.89,
        box: { x: 0.6, y: 0.62, width: 0.15, height: 0.24 },
        observedText: "GO ON Peanut Caramel"
      },
      {
        productId: "prot-batonins-creamy-crisp-barebells-55-g",
        catalogProductId: "prot-batonins-creamy-crisp-barebells-55-g",
        confidence: 0.88,
        box: { x: 0.79, y: 0.62, width: 0.15, height: 0.24 },
        observedText: "Barebells Creamy Crisp"
      },
      {
        productId: "prot-bat-pann-cot-zemenu-33-proc-go-on-50-g",
        catalogProductId: "prot-bat-pann-cot-zemenu-33-proc-go-on-50-g",
        confidence: 0.87,
        box: { x: 0.18, y: 0.88, width: 0.15, height: 0.1 },
        observedText: "GO ON Panna Cotta"
      },
      {
        productId: "prot-bat-kokosr-un-karamele-nutego-45-g",
        catalogProductId: "prot-bat-kokosr-un-karamele-nutego-45-g",
        confidence: 0.86,
        box: { x: 0.58, y: 0.88, width: 0.15, height: 0.1 },
        observedText: "NUTEGO Coconut Caramel"
      }
    ];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "multi-product-live-shelf",
        status: "matched",
        latencyMs: 1_200,
        model: "gemini-3.7-flash",
        imageStored: false,
        detections: recognitionAttempts === 1 ? detections.slice(0, 1) : detections
      })
    });
  });

  await page.route("**/api/resolve-products", async (route) => {
    const { detections } = route.request().postDataJSON() as { detections: unknown[] };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ detections, latencyMs: 1, imageStored: false })
    });
  });
  await unlock(page);

  await expect(page.getByRole("status")).toContainText("10 products · 10 with Sugar.no fit", { timeout: 10_000 });
  expect(recognitionAttempts).toBe(2);
  expect(focusModes).toEqual([false, false]);
  const scanner = page.getByLabel("Live camera scanner");
  await expect(scanner.locator('button[aria-label^="Open "]')).toHaveCount(10);
  await expect(page.getByRole("status")).toContainText("10 products · 10 with Sugar.no fit");
  await expect(page.getByLabel("Product result preview").locator("article")).toHaveCount(4);
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByLabel("Products ranked by Sugar.no fit").getByRole("button")).toHaveCount(10);
});

test("live camera shows package identities before optional retailer enrichment finishes", async ({ page }) => {
  await mockLiveCamera(page);
  const detections = [
    {
      productId: "visual:cola",
      catalogProductId: null,
      confidence: 0.96,
      box: { x: 0.08, y: 0.22, width: 0.38, height: 0.55 },
      observedText: "Coca-Cola Original 330 ml",
      identity: {
        brand: "Coca-Cola",
        name: "Coca-Cola Original 330 ml",
        variant: null,
        packSize: "330 ml",
        category: null,
        matchKind: "visual_only",
        searchQuery: "Coca-Cola Original 330 ml"
      },
      shelfPrice: null,
      retailerOffer: null,
      nutritionLinkConfidence: null
    },
    {
      productId: "visual:sanpellegrino",
      catalogProductId: null,
      confidence: 0.93,
      box: { x: 0.54, y: 0.2, width: 0.36, height: 0.57 },
      observedText: "Sanpellegrino Zero 330 ml",
      identity: {
        brand: "Sanpellegrino",
        name: "Sanpellegrino Zero 330 ml",
        variant: null,
        packSize: "330 ml",
        category: null,
        matchKind: "visual_only",
        searchQuery: "Sanpellegrino Zero 330 ml"
      },
      shelfPrice: null,
      retailerOffer: null,
      nutritionLinkConfidence: null
    }
  ];
  let releaseEnrichment!: () => void;
  let enrichmentFinished = false;
  const enrichmentGate = new Promise<void>((resolve) => {
    releaseEnrichment = resolve;
  });
  await page.route("**/api/recognize", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "fast-camera-result",
        status: "matched",
        latencyMs: 900,
        model: "qa-mock",
        imageStored: false,
        detections
      })
    });
  });
  await page.route("**/api/resolve-products", async (route) => {
    await enrichmentGate;
    enrichmentFinished = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ detections, latencyMs: 3_000, imageStored: false })
    });
  });

  await page.goto("/");
  await expect(page.getByLabel("Live camera scanner")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Products found. Checking Sugar.no signals", { timeout: 5_000 });
  await expect(page.getByLabel("Product result preview").getByText("Checking online…", { exact: true })).toHaveCount(2);
  expect(enrichmentFinished).toBe(false);
  releaseEnrichment();
  await expect.poll(() => enrichmentFinished).toBe(true);
  await expect(page.getByRole("status")).toContainText("No products with verified Sugar.no fit found");
  await expect(page.getByLabel("Product result preview")).toHaveCount(0);
});

test("a not-sure completion retry stops without exposing an unrated provisional product", async ({ page }) => {
  await mockLiveCamera(page);
  let recognitionRequests = 0;
  const focusModes: boolean[] = [];
  await page.route("**/api/recognize", async (route) => {
    recognitionRequests += 1;
    const request = route.request().postDataJSON() as { focusMode?: boolean };
    focusModes.push(Boolean(request.focusMode));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        recognitionRequests === 1
          ? {
              requestId: "provisional-product",
              status: "matched",
              latencyMs: 700,
              model: "qa-mock",
              imageStored: false,
              detections: [{
                productId: "visual:first-product",
                catalogProductId: null,
                confidence: 0.96,
                box: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
                observedText: "First Product",
                identity: {
                  brand: "First",
                  name: "First Product",
                  variant: null,
                  packSize: null,
                  category: null,
                  matchKind: "visual_only"
                },
                shelfPrice: null,
                retailerOffer: null
              }]
            }
          : {
              requestId: "completion-not-sure",
              status: "not_sure",
              latencyMs: 700,
              model: "qa-mock",
              imageStored: false,
              detections: []
            }
      )
    });
  });

  await unlock(page);
  await expect(page.getByRole("status")).toContainText("1 product found", { timeout: 10_000 });
  await expect(page.getByLabel("Live camera scanner").locator('button[aria-label^="Open First Product"]')).toHaveCount(0);
  await expect.poll(() => recognitionRequests, { timeout: 5_000 }).toBe(2);
  expect(focusModes).toEqual([false, false]);
  await expect(page.getByRole("button", { name: "View all", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "First Product" })).toHaveCount(0);
});

test("provider unavailability pauses live recognition and offers manual recovery", async ({ page }) => {
  await mockLiveCamera(page);
  let recognitionRequests = 0;
  await page.route("**/api/recognize", async (route) => {
    recognitionRequests += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "provider-unavailable",
        status: "provider_unavailable",
        latencyMs: 20,
        model: "none",
        imageStored: false,
        detections: []
      })
    });
  });

  await unlock(page);
  await expect(page.getByRole("status")).toContainText("Recognition is unavailable", { timeout: 6_000 });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show demo" })).toBeVisible();
  await page.waitForTimeout(2_500);
  expect(recognitionRequests).toBe(1);
});

test("HTTP 429 preserves a provisional product and pauses automatic spending retries", async ({ page }) => {
  await mockLiveCamera(page);
  let recognitionRequests = 0;
  await page.route("**/api/recognize", async (route) => {
    recognitionRequests += 1;
    if (recognitionRequests === 1) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          requestId: "rate-limit-provisional",
          status: "matched",
          latencyMs: 200,
          model: "qa-mock",
          imageStored: false,
          detections: [
            {
              productId: "visual:rate-limit-product",
              catalogProductId: null,
              confidence: 0.9,
              box: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
              observedText: "Rate Limit Product",
              identity: {
                brand: "Rate Limit",
                name: "Rate Limit Product",
                variant: null,
                packSize: null,
                category: null,
                matchKind: "visual_only"
              },
              shelfPrice: null,
              retailerOffer: null
            }
          ]
        })
      });
      return;
    }
    await route.fulfill({
      status: 429,
      headers: { "Retry-After": "7" },
      contentType: "application/json",
      body: JSON.stringify({ error: "rate_limited" })
    });
  });

  await unlock(page);
  await expect(page.getByRole("status")).toContainText(
    "Scanning paused. Try again in 7s or open the demo.",
    { timeout: 10_000 }
  );
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show demo" })).toBeVisible();
  await expect(page.getByLabel("Live camera scanner").locator('button[aria-label^="Open Rate Limit Product"]')).toHaveCount(0);
  await page.waitForTimeout(2_500);
  expect(recognitionRequests).toBe(2);
});

test("live camera groups repeated packs, holds the result and replaces it only after Scan again", async ({ page }) => {
  await mockLiveCamera(page);

  let currentProduct: "coke" | "activia" = "coke";
  let recognitionRequests = 0;
  const focusModes: boolean[] = [];
  await page.route("**/api/recognize", async (route) => {
    recognitionRequests += 1;
    const request = route.request().postDataJSON() as { focusMode?: boolean };
    focusModes.push(Boolean(request.focusMode));
    const identities =
      currentProduct === "coke"
        ? ["Coca-Cola Original Taste", "Coca Cola Original", "Coca-Cola Original Taste can", "Coca-Cola"]
        : ["Activia Forest Berries Yogurt"];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: `held-result-${recognitionRequests}`,
        status: "matched",
        latencyMs: 800,
        model: "gemini-3.7-flash",
        imageStored: false,
        detections: identities.map((name, index) => {
          const productId = `visual:${name.toLowerCase().replaceAll(" ", "-")}`;
          return {
            productId,
            catalogProductId: null,
            confidence: 0.96 - index * 0.01,
            box: { x: 0.08 + index * 0.2, y: 0.2, width: 0.16, height: 0.5 },
            observedText: name,
            identity: {
              brand: currentProduct === "coke" ? "Coca-Cola" : "Activia",
              name,
              variant: null,
              packSize: currentProduct === "coke" ? "330 ml" : "4 x 120 g",
              category: null,
              matchKind: "web_search"
            },
            shelfPrice: null,
            retailerOffer: null,
            inlineProduct: ratedInlineProduct({
              id: productId,
              brand: currentProduct === "coke" ? "Coca-Cola" : "Activia",
              name,
              score: currentProduct === "coke" ? 28 : 62,
              protein: currentProduct === "coke" ? 0 : 4.1,
              sugar: currentProduct === "coke" ? 10.6 : 8.4
            })
          };
        })
      })
    });
  });

  await page.route("**/api/resolve-products", async (route) => {
    const { detections } = route.request().postDataJSON() as { detections: unknown[] };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ detections, latencyMs: 1, imageStored: false })
    });
  });
  await unlock(page);

  await expect(page.getByRole("status")).toContainText("1 product · 1 with Sugar.no fit", { timeout: 10_000 });
  await expect(page.getByLabel("Live camera scanner").locator('button[aria-label^="Open "]')).toHaveCount(1);
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Coca-Cola Original Taste/ })).toBeVisible();
  const scanAgainButton = page.getByRole("button", { name: "Scan again" });
  await expect(scanAgainButton).toBeVisible();
  const scanAgainBox = await scanAgainButton.boundingBox();
  expect(scanAgainBox?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByLabel("Products ranked by Sugar.no fit")).toHaveCount(0);
  await page.waitForTimeout(2_500);
  expect(recognitionRequests).toBe(2);
  expect(focusModes).toEqual([false, false]);

  currentProduct = "activia";
  await page.getByRole("button", { name: "Scan again" }).click();
  await expect(page.getByRole("status")).toContainText("1 product · 1 with Sugar.no fit", { timeout: 10_000 });
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Activia Forest Berries Yogurt/ })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: /Coca-Cola Original Taste/ })).toHaveCount(0);
  expect(recognitionRequests).toBe(4);
  expect(focusModes).toEqual([false, false, false, false]);
});

test("a rated product keeps an honest inline retailer action without a duplicate price block", async ({ page }) => {
  await unlock(page);
  await page.route("**/api/products/**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        product: ratedInlineProduct({
          id: "barbora:gaz-dz-sanpellegrino-zero-peach-0-33-l-d",
          brand: "SAN PELLEGRINO",
          name: "Zero Peach · Pesca & Clementina · 330 ml",
          score: 72,
          protein: 0,
          sugar: 0
        }),
        alternatives: []
      })
    });
  });
  await page.route("**/api/resolve-products", async (route) => {
    const { detections } = route.request().postDataJSON() as { detections: unknown[] };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ detections, latencyMs: 1, imageStored: false })
    });
  });
  let exactSku = true;
  let includeShelfPrice = true;
  await page.route("**/api/recognize", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "generic-price-test",
        status: "matched",
        latencyMs: 2200,
        model: "gemini-3.7-flash",
        imageStored: false,
        detections: [
          {
            productId: "barbora:gaz-dz-sanpellegrino-zero-peach-0-33-l-d",
            catalogProductId: null,
            confidence: 0.94,
            box: { x: 0.18, y: 0.18, width: 0.64, height: 0.64 },
            observedText: "Sanpellegrino Zero Peach",
            identity: {
              brand: "Sanpellegrino",
              name: "Zero Peach",
              variant: "Pesca & Clementina",
              packSize: "330 ml",
              category: "Sparkling drink",
              matchKind: "barbora"
            },
            shelfPrice: includeShelfPrice
              ? { amount: 1.69, currency: "EUR", observedText: "1 69", confidence: 0.94 }
              : null,
            retailerOffer: {
              retailer: "Barbora",
              slug: "gaz-dz-sanpellegrino-zero-peach-0-33-l-d",
              title: "Gāzēts dzēriens SANPELLEGRINO Zero Peach 0,33L D",
              brand: "SAN PELLEGRINO",
              url: "https://barbora.lv/produkti/gaz-dz-sanpellegrino-zero-peach-0-33-l-d",
              price: 0.99,
              currency: "EUR",
              unitPrice: 3,
              unit: "l",
              imageUrl: null,
              checkedAt: "2026-08-20T12:00:00.000Z",
              matchConfidence: 0.82,
              exactSku
            }
          }
        ]
      })
    });
  });

  await page.waitForLoadState("networkidle");
  await chooseSavedPhoto(page, "price-check.png");
  await expect(page.getByRole("status")).toContainText("1 product · 1 with Sugar.no fit");
  await expect(page.getByText("Saved shelf or checkout photo", { exact: true })).toHaveCount(0);
  await expect(
    page.getByLabel("Product result preview").getByLabel("Shelf price €1.69, Barbora €0.99, cheaper at Barbora")
  ).toBeVisible();
  const compactBuy = page.getByLabel("Product result preview").getByRole("link", {
    name: /Buy Zero Peach.*cheaper at Barbora for €0.99/
  });
  await expect(compactBuy).toBeVisible();
  await expect(compactBuy).toHaveAttribute(
    "href",
    "https://barbora.lv/produkti/gaz-dz-sanpellegrino-zero-peach-0-33-l-d"
  );
  expect((await compactBuy.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: "docs/screenshots/price-cta-compact-mobile.png" });
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Zero Peach.*Pesca & Clementina.*330 ml/ })).toBeVisible();
  await expect(page.getByLabel("Saved shelf or checkout photo scanner").locator('button[aria-label^="Open "]')).toHaveCount(1);
  await expect(page.getByLabel("Shelf marker legend")).toHaveCount(0);
  await expect(page.getByLabel("Price comparison")).toHaveCount(0);
  await expect(page.getByText("Nutrition not verified online", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Scan nutrition label" })).toHaveCount(0);
  await expect(page.getByText("How this result was made", { exact: true })).toHaveCount(0);

  exactSku = false;
  await page.getByRole("button", { name: "Collapse product results" }).click();
  await page.getByRole("button", { name: "Back to live camera" }).click();
  await chooseSavedPhoto(page, "possible-price-check.png");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByLabel("Price comparison")).toHaveCount(0);
  await expect(page.getByLabel("Product result preview").getByRole("link", { name: /Buy .* cheaper at Barbora/ })).toHaveCount(0);

  exactSku = true;
  includeShelfPrice = false;
  await page.getByRole("button", { name: "Collapse product results" }).click();
  await page.getByRole("button", { name: "Back to live camera" }).click();
  await chooseSavedPhoto(page, "package-without-shelf-label.png");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByLabel("Price comparison")).toHaveCount(0);
  await expect(page.getByLabel(/Shelf price €/)).toHaveCount(0);
  await expect(page.getByText(/Keep the package and its shelf label/)).toHaveCount(0);
  await expect(page.getByLabel("Product result preview").getByRole("link", { name: /Buy .* cheaper at Barbora/ })).toHaveCount(0);
});

test("an exact Barbora food gets an on-demand two-factor Sugar.no fit", async ({ page }) => {
  await unlock(page);
  const productId = "barbora:zemesrieksti-estrella-ar-medu-140-g";
  await page.route("**/api/recognize", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "barbora-rating-test",
        status: "matched",
        latencyMs: 1_400,
        model: "gemini-3.7-flash",
        imageStored: false,
        detections: [
          {
            productId,
            catalogProductId: null,
            confidence: 0.96,
            box: { x: 0.18, y: 0.16, width: 0.64, height: 0.68 },
            observedText: "Estrella peanuts with honey",
            identity: {
              brand: "ESTRELLA",
              name: "Zemesrieksti ar medu",
              variant: null,
              packSize: "140 g",
              category: "Nuts",
              matchKind: "barbora"
            },
            shelfPrice: null,
            retailerOffer: null
          }
        ]
      })
    });
  });
  await page.route("**/api/products/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 450));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        product: {
          id: productId,
          retailerProductId: "zemesrieksti-estrella-ar-medu-140-g",
          brand: "ESTRELLA",
          name: "Zemesrieksti ESTRELLA ar medu 140g",
          shortName: "Zemesrieksti ESTRELLA ar medu 140g",
          aliases: [],
          format: "other",
          packSizeG: 140,
          nutritionBasis: "100g",
          energyKcalPer100: 594,
          gtin: null,
          nutrientsPer100g: { proteinG: 22, fiberG: null, totalSugarG: 14 },
          noAddedSugarClaim: false,
          imageUrl: null,
          retailerUrl: "https://barbora.lv/produkti/zemesrieksti-estrella-ar-medu-140-g",
          sources: [
            {
              label: "Exact Barbora product page",
              url: "https://barbora.lv/produkti/zemesrieksti-estrella-ar-medu-140-g",
              checkedAt: "2026-08-21T12:00:00.000Z",
              fields: ["identity", "retailerUrl", "protein", "totalSugar"],
              status: "secondary"
            }
          ],
          isGolden: false,
          accent: "coral",
          matchScore: 38,
          matchReason: "complete",
          ratingBasis: "barbora_reference",
          ratingStatus: "complete",
          ratingSignalCount: 2,
          ratingSignalMask: ["protein", "inverseSugar"],
          criterionScores: { protein: 55, inverseSugar: 20 }
        },
        alternatives: []
      })
    });
  });

  await page.waitForLoadState("networkidle");
  await chooseSavedPhoto(page, "exact-barbora-food.png");

  await expect(page.getByRole("status")).toContainText("Products found. Checking Sugar.no signals");
  await expect(page.getByText("Checking online…", { exact: true })).toBeVisible();
  const cameraOverlay = page.getByLabel("Saved shelf or checkout photo scanner");
  const ratedMarker = cameraOverlay.locator('button[aria-label^="Open "]').first();
  await expect(ratedMarker).toBeVisible();
  await expect(ratedMarker).not.toHaveAttribute("aria-label", /signals/i);
  await expect(cameraOverlay.getByText("2/2 signals", { exact: true })).toHaveCount(0);
  const markerChrome = await ratedMarker.evaluate((element) => {
    const style = getComputedStyle(element);
    return { borderColor: style.borderColor, boxShadow: style.boxShadow };
  });
  expect(markerChrome.borderColor).not.toBe("rgb(255, 255, 255)");
  expect(markerChrome.boxShadow).not.toContain("rgb(255, 255, 255)");
  await expect(page.getByRole("status")).toContainText("1 product · 1 with Sugar.no fit");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  const resultsDialog = page.getByRole("dialog", { name: "Products from this scan" });
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  await expect.poll(async () => (await resultsDialog.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(viewportHeight * 0.95);
  const badge = page.getByLabel("Sugar.no badge");
  await expect(badge.getByText("Sugar.no fit", { exact: true })).toBeVisible();
  await expect(badge.getByText("22g", { exact: true })).toBeVisible();
  await expect(badge.getByText("14g", { exact: true })).toBeVisible();
  await expect(badge.getByText("Fiber", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Values per 100 g · 2 of 2 source-backed signals", { exact: true })).toBeVisible();
  await expect(page.getByText("Best fit in this scan", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Data sources and limits", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "docs/screenshots/barbora-quick-view-mobile.png" });
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("entry experience has no automated WCAG A/AA violations", async ({ page }) => {
  await unlock(page);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(150);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations).toEqual([]);
});
