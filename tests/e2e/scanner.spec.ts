import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { shelfFixture } from "../fixtures/personal-shelf";
import type { ScoredProduct } from "../../src/lib/types";
import type { ShelfEvidence } from "../../src/lib/personal-shelf-rank";
import { applyShelfNutritionTrustGuard } from "../../src/lib/personal-shelf-rank";
import type { ExternalCatalogProduct } from "../../src/server/external-catalog-types";

async function authenticate(page: Page) {
  const response = await page.request.post("/api/auth", {
    headers: { origin: `http://127.0.0.1:${process.env.E2E_PORT || "3000"}` },
    data: { code: "e2e-demo-code" }
  });
  expect(response.status()).toBe(200);
}

async function unlock(page: Page) {
  await authenticate(page);
  await page.addInitScript(() => localStorage.setItem("sugar_scanner_onboarding_v1", "completed"));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const openCamera = page.getByRole("button", { name: "Open camera" });
  await expect(page.getByLabel("Live camera scanner").or(openCamera)).toBeVisible();
  if (await openCamera.isVisible()) await openCamera.click();
  await expect(page.getByLabel("Live camera scanner")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show demo" })).toBeVisible();
  await expect
    .poll(async () => {
      const retryVisible = await page.getByRole("button", { name: "Enable camera" }).isVisible().catch(() => false);
      const liveVideoVisible = await page.locator("video").isVisible().catch(() => false);
      return retryVisible || liveVideoVisible;
    })
    .toBe(true);
}

async function expectInsideViewport(_page: Page, locator: Locator) {
  await expect.poll(() => locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const width = window.visualViewport?.width || window.innerWidth;
    const height = window.visualViewport?.height || window.innerHeight;
    return rect.left >= -1 && rect.top >= -1 && rect.right <= width + 1 && rect.bottom <= height + 1;
  }), { message: "Element stays inside the viewport after its finite entrance transition" }).toBe(true);
}

async function expectNoDocumentOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
  ).toBe(true);
}

async function expectVisibleTouchTargets(page: Page) {
  const undersized = await page.locator("button, a[href], label").evaluateAll((elements) =>
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const visible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0 &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight;
      if (!visible || (rect.width >= 44 && rect.height >= 44)) return [];
      return [{
        label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 80) || element.tagName,
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }];
    })
  );
  expect(undersized).toEqual([]);
}

async function expectOfficialSugarNoLogo(page: Page) {
  const logo = page.getByAltText("Sugar.no", { exact: true });
  await expect(logo).toHaveCount(1);
  await expect(logo).toBeVisible();
  await expect
    .poll(
      () =>
        logo.evaluate((element) => {
          const image = element as HTMLImageElement;
          return image.complete ? image.naturalWidth : 0;
        }),
      { timeout: 5_000 }
    )
    .toBeGreaterThan(0);
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
  await expect(page.getByText(/^(Shelf photo|Checkout photo)$/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Leave feedback", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to live camera", exact: true })).toHaveCount(0);
}

async function openPersonalShelfFixture(page: Page, samples?: ScoredProduct[]) {
  const products = samples || [
    shelfFixture("qa-chips-a"), shelfFixture("qa-chips-b"),
    shelfFixture("qa-chips-c", { fiberG: null }),
    shelfFixture("qa-yogurt", { category: "Yogurt", ingredientsText: "Milk, cultures", fiberG: null, energyKcal: 100 }),
    shelfFixture("qa-cookie", { category: "Cookies", ingredientsText: "Wholegrain oats, sugar, butter", totalSugarG: 30 })
  ].map((product) => ({ ...product, id: `barbora:${product.id}`, shelfEvidence: { ...product.shelfEvidence!, productId: `barbora:${product.id}` } }));
  await page.route("**/api/recognize", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({
    requestId: "personal-shelf-qa", status: "matched", latencyMs: 1, model: "qa-fixture", imageStored: false,
    detections: products.map((product, index) => ({
      productId: product.id, catalogProductId: product.id, confidence: .99,
      box: { x: .02 + index * .19, y: .1, width: .16, height: .6 }, observedText: product.name,
      identity: { brand: product.brand, name: product.name, variant: null, packSize: "100g", category: product.category, matchKind: "barbora" },
      inlineProduct: product, shelfPrice: null, retailerOffer: null
    }))
  }) }));
  await page.route("**/api/offers", (route) => route.fulfill({ contentType: "application/json", body: '{"offers":{}}' }));
  await page.route("**/api/personal-shelf", (route) => route.fulfill({ contentType: "application/json", body: '{"evidence":{}}' }));
  await unlock(page);
  await chooseSavedPhoto(page, "synthetic-personal-shelf-qa.png");
  await expect(page.getByRole("dialog", { name: "Products from this scan" })).toBeVisible();
}

test("personal shelf pilot is opt-in, category-local, transparent and leaves original Fit unchanged", async ({ page }, testInfo) => {
  let evidenceRequests = 0;
  page.on("request", (request) => { if (request.url().endsWith("/api/personal-shelf")) evidenceRequests++; });
  await openPersonalShelfFixture(page);
  expect(evidenceRequests).toBe(0);
  const original = page.getByLabel("Products ranked by Sugar.no fit");
  await expect(original.getByRole("button")).toHaveCount(5);
  const originalText = await original.innerText();
  const toggle = page.getByRole("switch", { name: /Personal Shelf Rank/ });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  // Development Strict Mode can start then cancel the first effect. Neither read runs before opt-in.
  await expect.poll(() => evidenceRequests).toBeGreaterThan(0);
  expect(evidenceRequests).toBeLessThanOrEqual(2);
  const results = page.getByLabel("Personal Shelf Rank results");
  await expect(results).not.toContainText(/Within-type comparison|assessed in this|Need two for a relative rank|Not compared in this pilot|Missing or unverified/);
  const chips = results.getByRole("region", { name: "Chips", exact: true });
  await expect(chips.getByText("Provisional #1 of 3 in chips", { exact: true })).toHaveCount(2);
  await expect(chips.getByText("Not enough verified data", { exact: true })).toHaveCount(0);
  await expect(chips.getByText("Provisional · fiber unknown", { exact: true })).toBeVisible();
  await expect(chips.getByText(/71–81/)).toBeVisible();
  await expect(results.getByText("Score only · Spoonable yogurts", { exact: true })).toBeVisible();
  await chips.getByText("Why this score?", { exact: true }).first().click();
  const details = chips.locator("details[open]");
  await expect(details.locator("dt")).toHaveText(["Sugar", "Protein", "Food base", "Salt, saturates & fiber"]);
  await expect(results.getByRole("link", { includeHidden: true })).toHaveCount(0);
  await expect(results).not.toContainText(/Original ingredients|Per 100 g:|Checked \d|Model personal-shelf|Potatoes, sunflower oil, salt/);
  await expectNoDocumentOverflow(page);
  await expectVisibleTouchTargets(page);
  await page.screenshot({ path: testInfo.outputPath("personal-shelf-pilot.png"), fullPage: true });
  await toggle.click();
  await expect(original).toBeVisible();
  expect(await original.innerText()).toBe(originalText);
});

test("personal shelf pilot remains accessible on small phones, dark mode and enlarged text", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await openPersonalShelfFixture(page);
  await page.getByRole("switch", { name: /Personal Shelf Rank/ }).click();
  await expectNoDocumentOverflow(page);
  const results = await new AxeBuilder({ page }).include('[aria-label="Products from this scan"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("personal-shelf-dark.png"), fullPage: true });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await expectNoDocumentOverflow(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await expectNoDocumentOverflow(page);
  await expect(page.getByRole("button", { name: "Collapse product results" })).toBeVisible();
});

test("personal shelf pilot shows exact Livinn observations in the mobile comparison", async ({ page }, testInfo) => {
  const { readFile } = await import("node:fs/promises");
  // Do not load Next's JSON module graph into the standalone Node/Playwright runner.
  const observations: ShelfEvidence[] = JSON.parse(await readFile("data/personal-shelf-evidence.generated.json", "utf8"));
  const catalog: ExternalCatalogProduct[] = JSON.parse(await readFile("data/livinn-catalog.generated.json", "utf8"));
  const samples = ["03000011072", "03000011075", "03000011074"].map((sku) => {
    const id = `livinn_lt:${sku}`;
    const source = catalog.find((row) => row.sourceProductId === sku)!;
    const evidence = observations.find((row) => row.productId === id)!;
    return applyShelfNutritionTrustGuard({ ...shelfFixture(id, evidence), brand: source.brand, name: source.title, shortName: source.title, imageUrl: source.imageUrl, gtin: source.gtin });
  });
  // Recognition is mocked; ingredient/nutrition evidence below is the real dated snapshot.
  await openPersonalShelfFixture(page, samples);
  await page.getByRole("switch", { name: /Personal Shelf Rank/ }).click();
  const chips = page.getByRole("region", { name: "Chips", exact: true });
  await expect(chips.getByText("#1 of 2 in chips", { exact: true })).toBeVisible();
  await expect(chips.getByRole("heading", { level: 4 }).first()).toHaveText(samples[0].shortName);
  await expect(chips.getByText("64/100", { exact: true })).toBeVisible();
  await expect(chips.getByLabel("Not scored", { exact: true })).toHaveText("—");
  await expect(chips).not.toContainText(/Not enough verified data|Missing or unverified/);
  await expectNoDocumentOverflow(page);
  await expect.poll(() => chips.getByTestId("product-packshot").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete)), { timeout: 10_000 }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("personal-shelf-livinn.png"), fullPage: true, animations: "disabled" });
  await chips.getByText("Why this score?", { exact: true }).first().click();
  await expect(chips.locator("details[open]").locator("dd")).toHaveText(["10 / 10 points", "2.1 / 10 points", "22.5 / 30 points", "28.9 / 50 points"]);
  await expect(chips).not.toContainText(/Original ingredients|Per 100 g:|Checked \d|Model personal-shelf|Sudedamosios dalys/);
  await expect(chips.getByText("View available evidence", { exact: true })).toHaveCount(0);
  await expect(chips.getByRole("link", { includeHidden: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("personal-shelf-livinn-expanded.png"), fullPage: true, animations: "disabled" });
});

test("personal shelf pilot keeps incomplete cards compact and unsupported products in original Fit", async ({ page }, testInfo) => {
  const bar = { ...shelfFixture("barbora:qa-skriveru-bar", { category: "Snack bars" }), shelfEvidence: undefined };
  const candy = shelfFixture("barbora:qa-raffaello", { category: "Confectionery" });
  await openPersonalShelfFixture(page, [bar, candy]);
  const original = page.getByLabel("Products ranked by Sugar.no fit");
  const originalText = await original.innerText();
  const toggle = page.getByRole("switch", { name: /Personal Shelf Rank/ });
  await toggle.click();
  const results = page.getByLabel("Personal Shelf Rank results");
  await expect(results.getByRole("heading", { name: "Snack bars", exact: true })).toBeVisible();
  await expect(results.getByRole("heading", { level: 4 })).toHaveCount(1);
  await expect(results.getByLabel("Not scored", { exact: true })).toHaveText("—");
  await expect(results.locator("details")).toHaveCount(0);
  await expect(results).not.toContainText(/Within-type comparison|assessed in this|Not enough verified data|Missing or unverified|Not compared in this pilot|still need an exact identity/);
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("personal-shelf-compact-unknown.png"), fullPage: true });
  await toggle.click();
  expect(await original.innerText()).toBe(originalText);
  await expect(original.getByRole("button")).toHaveCount(2);
});

test("personal shelf pilot has a short empty state instead of the unsupported-product list", async ({ page }) => {
  const samples = [shelfFixture("barbora:qa-candy-a", { category: "Confectionery" }), shelfFixture("barbora:qa-candy-b", { category: "Confectionery" })];
  await openPersonalShelfFixture(page, samples);
  const toggle = page.getByRole("switch", { name: /Personal Shelf Rank/ });
  await toggle.click();
  const results = page.getByLabel("Personal Shelf Rank results");
  await expect(results.getByText("No ratings for this shelf yet. Switch off Personal Shelf Rank to view all products.", { exact: true })).toBeVisible();
  await expect(results.locator("ul")).toHaveCount(0);
  await expect(results).not.toContainText(/Not compared in this pilot|assessed in this|qa-candy/);
  await toggle.click();
  await expect(page.getByLabel("Products ranked by Sugar.no fit").getByRole("button")).toHaveCount(2);
});

async function mockSampleShelfRecognition(page: Page) {
  await authenticate(page);
  const response = await page.request.post("/api/recognize", { data: { source: "sample-shelf" } });
  expect(response.ok()).toBe(true);
  const sampleShelfBody = await response.text();
  await page.route("**/api/recognize", async (route) => {
    const body = route.request().postDataJSON() as { source?: string } | null;
    if (body?.source === "sample-shelf") {
      await route.fulfill({ contentType: "application/json", body: sampleShelfBody });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "cross-browser-camera-layout",
        status: "not_sure",
        detections: [],
        latencyMs: 1,
        model: "qa-mock",
        imageStored: false
      })
    });
  });
}

async function mockAlternativeOffers(page: Page, price = 1.49) {
  await page.route("**/api/offers", async (route) => {
    const { keys } = route.request().postDataJSON() as { keys: string[] };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        offers: Object.fromEntries(keys.map((key) => {
          const [source, ...idParts] = key.split(":");
          const slug = idParts.join(":");
          const retailer = source === "rimi_lv"
            ? "Rimi"
            : source === "livin_lv"
              ? "Livin"
              : "Barbora";
          const url = retailer === "Barbora"
            ? `https://barbora.lv/produkti/${slug}`
            : retailer === "Rimi"
              ? `https://www.rimi.lv/e-veikals/lv/produkti/${slug}`
              : `https://www.livin.lv/products/${slug}`;

          return [key, {
            retailer,
            slug,
            title: slug,
            brand: "Test brand",
            url,
            price,
            currency: "EUR",
            unitPrice: null,
            unit: null,
            imageUrl: null,
            checkedAt: "2026-08-26T10:00:00.000Z",
            matchConfidence: 1,
            exactSku: true
          }];
        }))
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
    (window as Window & { __cameraScene?: number }).__cameraScene = 0;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 960;
    const context = canvas.getContext("2d");
    context?.fillRect(0, 0, canvas.width, canvas.height);
    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<typeof originalDrawImage>
    ) {
      if (args[0] instanceof HTMLVideoElement) return;
      return originalDrawImage.apply(this, args);
    } as typeof originalDrawImage;
    CanvasRenderingContext2D.prototype.getImageData = function (
      this: CanvasRenderingContext2D,
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      settings?: ImageDataSettings
    ) {
      if (sw === 96 && sh === 72) {
        const imageData = originalGetImageData.call(this, sx, sy, sw, sh, settings);
        const { data } = imageData;
        const scene = (window as Window & { __cameraScene?: number }).__cameraScene || 0;
        for (let y = 0; y < sh; y += 1) {
          for (let x = 0; x < sw; x += 1) {
            const offset = (y * sw + x) * 4;
            const value = scene === 0
              ? (x * 37 + y * 71 + x * y * 13) % 223 + 16
              : (x * 19 + y * 43 + x * y * 7 + 97) % 223 + 16;
            data[offset] = value;
            data[offset + 1] = value;
            data[offset + 2] = value;
            data[offset + 3] = 255;
          }
        }
        return imageData;
      }
      return originalGetImageData.call(this, sx, sy, sw, sh, settings);
    };
    HTMLMediaElement.prototype.play = async function (this: HTMLMediaElement) {
      if (this instanceof HTMLVideoElement) {
        (window as Window & { __cameraPlayAt?: number }).__cameraPlayAt = performance.now();
        Object.defineProperties(this, {
          readyState: { configurable: true, get: () => 4 },
          videoWidth: { configurable: true, get: () => 640 },
          videoHeight: { configurable: true, get: () => 960 }
        });
      }
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          (window as Window & { __cameraConstraints?: MediaStreamConstraints }).__cameraConstraints = constraints;
          return canvas.captureStream(5);
        }
      }
    });
  });
}

test("first live recognition waits for camera positioning before capturing", async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    (window as Window & { __cameraRecognitionTimes?: number[] }).__cameraRecognitionTimes = [];
    window.fetch = async (...args) => {
      const input = args[0];
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/recognize")) {
        (window as Window & { __cameraRecognitionTimes?: number[] }).__cameraRecognitionTimes?.push(performance.now());
      }
      return originalFetch(...args);
    };
  });
  await mockLiveCamera(page);
  let recognitionRequests = 0;
  await page.route("**/api/recognize", async (route) => {
    recognitionRequests += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "initial-camera-delay",
        status: "not_sure",
        detections: [],
        latencyMs: 1,
        model: "qa-mock",
        imageStored: false
      })
    });
  });

  await unlock(page);
  await expect(page.getByRole("status")).toContainText("Point at several products and hold steady");
  await expect.poll(() => recognitionRequests, { timeout: 5_000 }).toBe(1);
  const initialDelay = await page.evaluate(() => {
    const state = window as Window & { __cameraPlayAt?: number; __cameraRecognitionTimes?: number[] };
    return (state.__cameraRecognitionTimes?.[0] ?? 0) - (state.__cameraPlayAt ?? 0);
  });
  expect(initialDelay).toBeGreaterThanOrEqual(1_450);

  const retryButton = page.getByRole("button", { name: "Not sure — try again", exact: true });
  await expect(retryButton).toBeVisible();
  await page.evaluate(() => {
    (window as Window & { __cameraRetryAt?: number }).__cameraRetryAt = performance.now();
  });
  await retryButton.click();
  await expect.poll(() => recognitionRequests, { timeout: 3_000 }).toBe(2);
  const retryDelay = await page.evaluate(() => {
    const state = window as Window & {
      __cameraRecognitionTimes?: number[];
      __cameraRetryAt?: number;
    };
    return (state.__cameraRecognitionTimes?.[1] ?? 0) - (state.__cameraRetryAt ?? 0);
  });
  expect(retryDelay).toBeLessThan(1_450);
});

test("first visit explains the pilot before requesting camera permission", async ({ page }) => {
  await page.addInitScript(() => {
    let cameraRequests = 0;
    Object.defineProperty(window, "__cameraRequests", { configurable: true, get: () => cameraRequests });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => {
        cameraRequests += 1;
        return Promise.reject(new DOMException("Denied in test", "NotAllowedError"));
      } }
    });
  });
  await page.goto("/");
  await expect(page.getByLabel("Demo access code")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Find a better fit." })).toBeVisible();
  await expect(page.getByText("Point your camera at a shelf.Compare similar productsby sugar and protein.")).toBeVisible();
  await expect(page.getByTestId("onboarding-preview")).toBeVisible();
  await expect(page.getByAltText("Protein bars on a shop shelf. Four products are outlined and one is labelled Great fit.")).toBeVisible();
  await expect(page.getByText("4 products compared")).toBeVisible();
  await expect(page.getByText("Best fit appears first")).toBeVisible();
  await expect(page.getByText("Camera opens only after you choose Open camera. Photos are not saved.")).toBeVisible();
  const openCameraBox = await page.getByRole("button", { name: "Open camera" }).boundingBox();
  const sampleBox = await page.getByRole("button", { name: "Try a sample shelf" }).boundingBox();
  const privacyBox = await page.getByText("Camera opens only after you choose Open camera. Photos are not saved.").boundingBox();
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(openCameraBox?.y).toBeGreaterThan(0);
  expect((sampleBox?.y ?? viewportHeight) + (sampleBox?.height ?? 0)).toBeLessThanOrEqual(viewportHeight);
  expect((privacyBox?.y ?? viewportHeight) + (privacyBox?.height ?? 0)).toBeLessThanOrEqual(viewportHeight);
  await expectNoDocumentOverflow(page);
  await expectVisibleTouchTargets(page);
  expect(await page.evaluate(() => (window as Window & { __cameraRequests?: number }).__cameraRequests)).toBe(0);
  await page.getByRole("button", { name: "Open camera" }).click();
  await expect(page.getByLabel("Live camera scanner")).toBeVisible();
  await expectOfficialSugarNoLogo(page);
  await expect(page.getByText("Live camera", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Camera permission is off")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable camera" })).toBeVisible();
  await expect(page.getByTestId("scan-guide")).toHaveCount(0);
  const demoButtonBox = await page.getByRole("button", { name: "Show demo" }).boundingBox();
  const cameraViewportBox = await page.getByTestId("camera-viewport").boundingBox();
  expect(cameraViewportBox?.x).toBeLessThanOrEqual(1);
  expect(Math.abs((cameraViewportBox?.width ?? 0) - (await page.evaluate(() => window.innerWidth)))).toBeLessThanOrEqual(1);
  expect(demoButtonBox?.y).toBeGreaterThanOrEqual(cameraViewportBox?.y ?? 0);
  expect((demoButtonBox?.y ?? 0) + (demoButtonBox?.height ?? 0)).toBeLessThanOrEqual(
    (cameraViewportBox?.y ?? 0) + (cameraViewportBox?.height ?? 0)
  );
  await expect(page.getByText("Private demo", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Sent to Google Gemini/i)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("sugar_scanner_onboarding_v1"))).toBe("completed");
  expect(await page.evaluate(() => (window as Window & { __cameraRequests?: number }).__cameraRequests)).toBe(1);
});

test("completed onboarding stays hidden unless QA forces it", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sugar_scanner_onboarding_v1", "skipped");
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => Promise.reject(new DOMException("Denied in test", "NotAllowedError")) }
    });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find a better fit." })).toHaveCount(0);
  await expect(page.getByLabel("Live camera scanner")).toBeVisible();
  await page.goto("/?onboarding=1");
  await expect(page.getByRole("heading", { name: "Find a better fit." })).toBeVisible();
});

test("sample shelf dismisses onboarding without requesting camera permission", async ({ page }) => {
  await page.addInitScript(() => {
    let cameraRequests = 0;
    Object.defineProperty(window, "__cameraRequests", { configurable: true, get: () => cameraRequests });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => {
        cameraRequests += 1;
        return Promise.reject(new DOMException("Denied in test", "NotAllowedError"));
      } }
    });
  });
  await page.goto("/?onboarding=1");
  await expect(page.getByRole("heading", { name: "Find a better fit." })).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { __cameraRequests?: number }).__cameraRequests)).toBe(0);
  await page.getByRole("button", { name: "Try a sample shelf" }).click();
  await expect(page.getByLabel("Shelf photo scanner")).toBeVisible();
  await expect(page.getByText("Shelf photo", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("sugar_scanner_onboarding_v1"))).toBe("completed");
  expect(await page.evaluate(() => (window as Window & { __cameraRequests?: number }).__cameraRequests)).toBe(0);
});

test("anonymous analytics visit spans onboarding, multiple scans and reload", async ({ page }) => {
  const events: { name: string; sessionId: string; browserSessionId: string }[] = [];
  await page.route("**/api/events", async (route) => {
    events.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  await page.goto("/?onboarding=1");
  await page.getByRole("button", { name: "Try a sample shelf" }).click();
  await expect.poll(() => events.filter((event) => event.name === "scan_completed").length).toBe(1);
  await page.getByRole("button", { name: "Scan again", exact: true }).click();
  await openDemoScene(page, "Checkout demo");
  await expect.poll(() => events.filter((event) => event.name === "scan_completed").length).toBe(2);
  const scans = events.filter((event) => event.name === "scan_started");
  expect(new Set(scans.map((event) => event.sessionId)).size).toBe(2);
  expect(events.some((event) => event.name === "onboarding_completed")).toBe(true);
  await page.reload();
  await expect.poll(() => events.filter((event) => event.name === "app_opened").length).toBe(2);
  expect(events[0].browserSessionId).toMatch(/^[0-9a-f-]{36}$/);
  expect(new Set(events.map((event) => event.browserSessionId)).size).toBe(1);
});

test("sample overlays track the contained photo after onboarding and resizing", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?onboarding=1");
  await page.getByRole("button", { name: "Try a sample shelf", exact: true }).click();
  await expect(page.getByTestId("rated-detection-marker")).toHaveCount(4);

  for (const viewport of [{ width: 1280, height: 720 }, { width: 402, height: 874 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.evaluate(() => {
      const photo = document.querySelector<HTMLImageElement>('img[alt="Four protein bars on a supermarket shelf"]');
      const marker = document.querySelector<HTMLElement>('[data-testid="rated-detection-marker"]');
      if (!photo?.naturalWidth || !marker) return Infinity;
      const bounds = photo.getBoundingClientRect();
      const scale = Math.min(bounds.width / photo.naturalWidth, bounds.height / photo.naturalHeight);
      const renderedWidth = photo.naturalWidth * scale;
      const renderedHeight = photo.naturalHeight * scale;
      const actual = marker.getBoundingClientRect();
      const expectedLeft = bounds.left + (bounds.width - renderedWidth) / 2 + .01 * renderedWidth;
      const expectedTop = bounds.top + (bounds.height - renderedHeight) / 2 + .27 * renderedHeight;
      return Math.max(
        Math.abs(actual.left - expectedLeft),
        Math.abs(actual.top - expectedTop),
        Math.abs(actual.width - .24 * renderedWidth),
        Math.abs(actual.height - .28 * renderedHeight)
      );
    })).toBeLessThan(2);
  }
  await page.screenshot({ path: "test-results/pen-contained-photo-wide.png" });
});

test("onboarding motion is one-time and respects reduced motion", async ({ page }) => {
  await page.goto("/?onboarding=1");
  await expectOfficialSugarNoLogo(page);
  const preview = page.getByTestId("onboarding-preview");
  await expect(preview).toBeVisible();
  expect(await preview.evaluate((element) => getComputedStyle(element, "::before").animationName)).toContain("onboarding-scan-pass");
  expect(await preview.evaluate((element) => getComputedStyle(element, "::before").animationIterationCount)).toBe("1");
  expect(await preview.evaluate((element) => getComputedStyle(element, "::before").animationDuration)).toBe("3.2s");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(preview).toBeVisible();
  expect(await preview.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  expect(await preview.evaluate((element) => getComputedStyle(element, "::before").display)).toBe("none");
  expect(await page.getByRole("button", { name: "Open camera" }).evaluate((element) =>
    getComputedStyle(element).transitionDuration
      .split(",")
      .every((value) => Number.parseFloat(value) <= 0.001)
  )).toBe(true);
});

test("anonymous feedback validates Needs work and shows success", async ({ page }) => {
  await page.route("**/api/feedback", async (route) => {
    const body = route.request().postDataJSON() as { helpful: boolean; reason: string; comment: string };
    expect(body).toMatchObject({ helpful: false, reason: "unclear", comment: "Hard to understand" });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, storage: "supabase" }) });
  });
  await unlock(page);
  const feedbackTrigger = page.getByRole("button", { name: "Leave feedback" });
  await expect(feedbackTrigger).toContainText("Leave feedback");
  await expect(feedbackTrigger).toHaveCSS("white-space", "nowrap");
  expect((await feedbackTrigger.boundingBox())?.width).toBeGreaterThanOrEqual(120);
  await feedbackTrigger.click();
  const dialog = page.getByRole("dialog", { name: "Was this scan helpful?" });
  // Measure spacing after the dialog's entrance transform has settled.
  await dialog.evaluate(async (element) => {
    await Promise.all(element.getAnimations({ subtree: true })
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => undefined)));
  });
  const ratingBox = await dialog.getByRole("group", { name: "Feedback rating" }).boundingBox();
  const submitBox = await dialog.getByRole("button", { name: "Send feedback" }).boundingBox();
  expect((submitBox?.y ?? 0) - ((ratingBox?.y ?? 0) + (ratingBox?.height ?? 0))).toBeGreaterThanOrEqual(8);
  await dialog.getByRole("button", { name: "Needs work" }).click();
  await expect(dialog.getByRole("button", { name: "Send feedback" })).toBeDisabled();
  await dialog.getByLabel("Result was unclear").check();
  await dialog.getByPlaceholder("Tell us what you noticed").fill("Hard to understand");
  await dialog.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();
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
    "--canvas": "#f2f2f7",
    "--surface": "#fff",
    "--surface-tinted": "#f2f2f7",
    "--ink": "#262626",
    "--muted": "#60606a",
    "--accent": "#0a84ff",
    "--border": "#e8e9ef",
    "--focus": "#0a84ff"
  });

  await openDemoScene(page, "Shelf demo");
  await expect(page.locator("aside")).toHaveCSS("background-color", "rgb(242, 242, 247)");
  await expect(page.getByRole("status")).toHaveCSS("background-color", "rgba(255, 255, 255, 0.94)");
  const markers = page.getByLabel("Shelf photo scanner").locator('button[aria-label^="Open "]');
  await expect(markers).toHaveCount(4);
  await expect(markers.and(page.getByRole("button", { name: /: Great fit$/ }))).toHaveCount(2);
  await expect(markers.and(page.getByRole("button", { name: /: Moderate fit$/ }))).toHaveCount(2);
  const markerFillAlphas = await markers.evaluateAll((elements) =>
    elements.map((element) => {
      const color = getComputedStyle(element).backgroundColor;
      const rgbaAlpha = color.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1];
      const modernAlpha = color.match(/\/\s*([\d.]+)\)/)?.[1];
      return Number(rgbaAlpha || modernAlpha || 1);
    })
  );
  expect(markerFillAlphas.every((alpha) => alpha >= 0.09 && alpha <= 0.11)).toBe(true);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`result motion keeps rapid navigation and focus usable (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await mockAlternativeOffers(page);
    await unlock(page);
    await openDemoScene(page, "Shelf demo");
    const viewAll = page.getByRole("button", { name: "View all", exact: true });
    const dialog = page.getByRole("dialog", { name: "Products from this scan" });
    const content = dialog.locator("#scan-results-content");
    // Dispatch without Playwright's stability wait so navigation can interrupt entry.
    await viewAll.focus();
    await viewAll.dispatchEvent("click");
    await expect(dialog).toBeVisible();
    const animated = await content.evaluate((el) => getComputedStyle(el).animationName !== "none");
    expect(animated).toBe(reducedMotion === "no-preference");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(viewAll).toBeFocused();

    await viewAll.dispatchEvent("click");
    await dialog.getByRole("button", { name: "Rank 1, BAREBELLS Salty Peanut, Great fit", exact: true }).dispatchEvent("click");
    await expect(dialog.getByRole("heading", { name: "Salty Peanut", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Back to all results" }).dispatchEvent("click");
    await expect(dialog.getByRole("heading", { name: "Best fit first" })).toBeVisible();
    await expect(dialog).toBeFocused();
    // A system preference change also stops an entry already in progress.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(content).toHaveCSS("animation-name", "none");
    await expect(content).toHaveCSS("transform", "none");
    const carousel = dialog.getByRole("group", { name: "Alternative products" });
    await carousel.getByRole("link").last().scrollIntoViewIfNeeded();
    await expectInsideViewport(page, carousel.getByRole("link").last());
    await expectNoDocumentOverflow(page);
    await page.keyboard.press("Escape");
    await expect(viewAll).toBeFocused();

    await page.emulateMedia({ reducedMotion });
    const feedback = page.getByRole("button", { name: "Leave feedback", exact: true });
    await feedback.dispatchEvent("click");
    await expect(page.getByRole("dialog", { name: /Was this scan/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(feedback).toBeFocused();
  });
}

test("ordinary Shelf demo rates all four bars in Personal Shelf without evidence requests", async ({ page }) => {
  let evidenceRequests = 0;
  await page.route("**/api/personal-shelf", async (route) => { evidenceRequests++; await route.abort(); });
  await mockAlternativeOffers(page);
  await unlock(page);
  await openDemoScene(page, "Shelf demo");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  const original = page.getByLabel("Products ranked by Sugar.no fit");
  await expect(original.getByRole("button")).toHaveCount(4);
  const originalNames = await original.getByRole("button").allTextContents();
  await page.getByRole("switch", { name: "Personal Shelf Rank Pilot", exact: true }).click();
  const personal = page.getByRole("region", { name: "Personal Shelf Rank results", exact: true });
  await expect(personal.getByRole("heading", { name: "Snack bars", exact: true })).toBeVisible();
  await expect(personal.getByRole("heading", { name: "Cookies & wafers", exact: true })).toHaveCount(0);
  await expect(personal.locator("h4")).toHaveCount(4);
  await expect(personal.locator("img")).toHaveCount(4);
  await expect.poll(() => personal.locator("img").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(personal.getByText("Provisional #1 of 4 in snack bars", { exact: true })).toHaveCount(4);
  await expect(personal.getByText("Provisional · fiber unknown", { exact: true })).toHaveCount(4);
  await expect(personal.getByRole("img", { name: "Not scored", exact: true })).toHaveCount(0);
  await expect(personal.locator("strong").filter({ hasText: "59/100" })).toHaveCount(4);
  await personal.getByText("Why this score?", { exact: true }).first().click();
  await expect(personal.getByText("Pilot ceiling 59/100: high saturated fat per 100 g. Protein cannot cancel this limit.").first()).toBeVisible();
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: test.info().outputPath("shelf-demo-personal-rank.png"), fullPage: true, animations: "disabled" });
  expect(evidenceRequests).toBe(0);
  await page.getByRole("switch", { name: "Personal Shelf Rank Pilot", exact: true }).click();
  await expect(original.getByRole("button")).toHaveText(originalNames);
});

test("sample shelf photo highlights products and ranks two-factor Sugar.no fits", async ({ page }) => {
  await mockAlternativeOffers(page);
  await unlock(page);
  await openDemoScene(page, "Shelf demo");
  await expect(page.getByRole("status")).toContainText("4 products · 4 with Sugar.no fit");
  const preview = page.getByLabel("Product result preview");
  await expect(preview.getByRole("button")).toHaveCount(4);
  await expect(preview.getByRole("button").first()).toHaveAccessibleName("Rank 1, BAREBELLS Salty Peanut, Great fit, Sugar 2.3 grams per 100 grams");
  await expect(preview.getByText(/^Sugar [0-9.]+\s+g$/)).toHaveCount(4);
  const markers = page.getByTestId("rated-detection-marker");
  await expect(markers).toHaveCount(4);
  await expect(page.locator('svg[data-fit-icon="great"]')).toHaveCount(2);
  await expect(page.locator('svg[data-fit-icon="moderate"]')).toHaveCount(2);
  await markers.and(page.getByRole("button", { name: /: Moderate fit$/ })).first().click();
  await expect(markers).toHaveText(["", "", "", ""]);
  await expect(preview.getByText("Great fit", { exact: true })).toHaveCount(2);
  await expect(preview.getByLabel("Moderate fit", { exact: true })).toHaveCount(2);
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: "test-results/shelf-mobile.png" });
  await page.getByRole("button", { name: "View all", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Products from this scan" });
  const ranking = dialog.getByLabel("Products ranked by Sugar.no fit");
  await expect(ranking.getByRole("button")).toHaveCount(4);
  await expect(dialog.getByRole("heading", { name: "Best fit first" })).toBeVisible();
  await expectOfficialSugarNoLogo(page);
  const offer = ranking.getByRole("link", { name: /Buy cheaper online Salty Peanut at Barbora for €2\.79/ });
  await expect(offer).toHaveAttribute("href", "https://barbora.lv/produkti/prot-bat-sal-riekst-saldin-barebells-55-g");
  await expect(offer.locator("s")).toHaveText("€3.49");
  await expect(offer).toHaveCSS("min-height", "56px");
  expect(await offer.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("linear-gradient");
  await page.screenshot({ path: "test-results/shelf-results-mobile.png" });
  await ranking.getByRole("button", { name: "Rank 1, BAREBELLS Salty Peanut, Great fit" }).click();
  await expect(dialog.getByRole("heading", { name: "Salty Peanut", exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Sugar.no badge")).toContainText("2.3 g");
  await expect(dialog.getByLabel("Sugar.no badge")).toContainText("36 g");
  await expect(dialog.getByRole("link", { name: /Buy cheaper online/ })).toHaveAttribute("href", "https://barbora.lv/produkti/prot-bat-sal-riekst-saldin-barebells-55-g");
  const alternatives = dialog.getByRole("region", { name: "Same product type · Great fit only" });
  await expect(alternatives.getByRole("link", { name: /Buy online .* for €1\.49/ })).toHaveCount(4);
  await expect(alternatives.getByText("Great fit", { exact: true })).toHaveCount(4);
  await expect(alternatives.getByText("Moderate fit", { exact: true })).toHaveCount(0);
  const hrefs = await alternatives.getByRole("link").evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
  expect(hrefs.every((href) => /^https:\/\/(?:www\.rimi\.lv|barbora\.lv|www\.livin\.lv)\//.test(href))).toBe(true);
  await page.screenshot({ path: "test-results/product-detail-mobile.png" });
  await dialog.getByRole("button", { name: "Back to all results" }).click();
  await expect(ranking).toBeVisible();
  await dialog.getByRole("button", { name: "Collapse product results" }).click();
  await preview.getByRole("button", { name: /Rank 4/ }).click();
  await expect(dialog.getByRole("heading", { name: "Lemon Cheesecake", exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Sugar.no badge")).toContainText("3.8 g");
  await expectNoDocumentOverflow(page);
  // Approved normal-mode badge colors are retained; the system's increased
  // contrast preference supplies an accessible variant of the same components.
  await page.emulateMedia({ contrast: "more" });
  // Measure final colors after entrance opacity has settled, not a blended frame.
  await dialog.evaluate(async (element) => {
    await Promise.all(element.getAnimations({ subtree: true })
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => undefined)));
  });
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("alternative carousel shows one card and a preview while keeping every product reachable", async ({ page }) => {
  await mockAlternativeOffers(page);
  await unlock(page);
  await openDemoScene(page, "Shelf demo");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Products from this scan" });
  const alternatives = dialog.getByRole("region", { name: "Same product type · Great fit only" });
  await expect(alternatives.getByRole("link")).toHaveCount(4);
  for (const mode of ["list", "detail"] as const) {
    if (mode === "detail") {
      await dialog.getByRole("button", { name: "Rank 1, BAREBELLS Salty Peanut, Great fit", exact: true }).click();
      await expect(dialog.getByRole("heading", { name: "Salty Peanut", exact: true })).toBeVisible();
    }
    for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 402, height: 874 }, { width: 1080, height: 900 }]) {
      await page.setViewportSize(viewport);
      const carousel = alternatives.getByRole("group", { name: "Alternative products" });
      await carousel.scrollIntoViewIfNeeded();
      await carousel.evaluate((el) => el.scrollTo({ left: 0, behavior: "instant" }));
      await expect.poll(() => carousel.evaluate((el) => el.scrollLeft)).toBe(0);
      const bounds = await carousel.evaluate((track) => {
        const rect = track.getBoundingClientRect();
        const cards = Array.from(track.querySelectorAll("article"));
        const first = cards[0].getBoundingClientRect();
        const next = cards[1].getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          firstLeft: first.left - rect.left,
          firstRight: rect.right - first.right,
          nextVisible: (rect.right - next.left) / next.width,
          scrolls: track.scrollWidth > track.clientWidth,
          cards: cards.map((card) => ({
            overflow: card.scrollWidth > card.clientWidth + 1,
            overflowingContent: Array.from(card.querySelectorAll("button, a, strong, small")).some((child) => child.scrollWidth > child.clientWidth + 1)
          }))
        };
      });
      expect(bounds.left).toBeGreaterThanOrEqual(12);
      expect(bounds.right).toBeLessThanOrEqual(viewport.width - 12);
      expect(Math.abs(bounds.firstLeft)).toBeLessThanOrEqual(1);
      expect(bounds.firstRight).toBeGreaterThan(0);
      expect(bounds.nextVisible).toBeGreaterThanOrEqual(.27);
      expect(bounds.nextVisible).toBeLessThanOrEqual(.33);
      expect(bounds.scrolls).toBe(true);
      expect(bounds.cards).toHaveLength(4);
      for (const card of bounds.cards) {
        expect(card.overflow).toBe(false);
        expect(card.overflowingContent).toBe(false);
      }
      const heading = alternatives.getByRole("heading");
      expect(await heading.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: `test-results/alternatives-${mode}-${viewport.width}.png`, scale: "css" });
      await carousel.focus();
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => carousel.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      for (const link of await alternatives.getByRole("link").all()) {
        await link.scrollIntoViewIfNeeded();
        await expectInsideViewport(page, link);
        expect(await link.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return !!target && el.contains(target);
        })).toBe(true);
      }
      await expectNoDocumentOverflow(page);
    }
  }
});

test("broken product packshot falls back to its crop from the scanned scene", async ({ page }) => {
  await page.route("**/_next/image?*", async (route) => {
    const source = new URL(route.request().url()).searchParams.get("url");
    if (source?.includes("/demo-products/salty-peanut.png")) {
      await route.fulfill({ status: 404, contentType: "image/png", body: "" });
      return;
    }
    await route.continue();
  });

  await unlock(page);
  await openDemoScene(page, "Shelf demo");

  await page.getByRole("button", { name: "View all", exact: true }).click();
  const firstProduct = page.getByLabel("Products ranked by Sugar.no fit").getByRole("button").first();
  await expect(firstProduct.getByTestId("product-packshot")).toHaveCount(0);
  await expect(firstProduct.getByTestId("scene-product-crop")).toBeVisible();
  await expect(firstProduct.getByTestId("scene-product-crop")).toHaveAttribute(
    "data-thumbnail-mode",
    "context-crop"
  );
});

test("checkout photo recognizes and rates three products on the belt", async ({ page }) => {
  await unlock(page);
  await openDemoScene(page, "Checkout demo");
  await expect(page.getByRole("status")).toContainText("3 products · 3 with Sugar.no fit");
  const checkoutMarkers = page.getByLabel("Checkout photo scanner").locator('button[aria-label^="Open "]');
  await expect(checkoutMarkers).toHaveCount(3);
  await expect(checkoutMarkers.and(page.getByRole("button", { name: /: Great fit$/ }))).toHaveCount(2);
  await expect(checkoutMarkers.and(page.getByRole("button", { name: /: Moderate fit$/ }))).toHaveCount(1);
  await expect(page.getByText("Sugar per 100 g / 100 ml · best fit first", { exact: true })).toBeVisible();
  await expect(page.getByAltText("Groceries on a real supermarket checkout conveyor belt")).toBeVisible();
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLImageElement>('div[aria-label="Real supermarket checkout belt sample with three recognized packaged products"] img')]
      .every((image) => image.complete && image.naturalWidth > 0)
  );
  await page.screenshot({ path: "test-results/checkout-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "View all", exact: true }).click();
  const ranking = page.getByLabel("Products ranked by Sugar.no fit");
  await expect(ranking).toBeVisible({ timeout: 8_000 });
  await expect(ranking.getByRole("button")).toHaveCount(3);
  await expect(ranking.getByTestId("scene-product-crop")).toHaveCount(3);
  await expect(ranking.getByText("SPROUD", { exact: true })).toBeVisible();
  await expect(ranking.getByText("SCHNITZER", { exact: true })).toBeVisible();
  await expect(ranking.getByText("STOCKMANN", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Best fit first" })).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/checkout-results-mobile.png" });
  await expect(page.getByText("Best fit in this scan", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Sugar.no badge")).toHaveCount(0);
  await expect(ranking.getByText(/Sugar \d+(?:\.\d+)?g/)).toHaveCount(3);
  await expect(ranking.getByText(/Protein \d+(?:\.\d+)?g/)).toHaveCount(3);
  await expect(ranking.getByText(/Carbs \d+(?:\.\d+)?g/)).toHaveCount(0);
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
  const chooser = page.getByRole("dialog", { name: "See how a shelf scan works" });
  await expect(chooser).toHaveCSS("background-color", "rgb(242, 242, 247)");
  expect(await chooser.getByRole("button", { name: "Back to live camera" }).evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("linear-gradient");
  await page.getByRole("button", { name: "Shelf demo" }).click();
  await expect(page.getByRole("status")).toContainText("4 products · 4 with Sugar.no fit");
  await expect(page.getByRole("button", { name: "View all", exact: true })).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.getByRole("button", { name: "Scan again", exact: true }).click();
  await expect(page.getByLabel("Live camera scanner")).toBeVisible();
  await openDemoScene(page, "Checkout demo");
  await expect(page.getByRole("status")).toContainText("3 products · 3 with Sugar.no fit");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Best fit first" })).toBeVisible();
  await expect(page.getByRole("button", { name: /save/i })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Saved options" })).toHaveCount(0);
  await page.getByRole("button", { name: "Collapse product results" }).click();
  await expect(page.getByRole("button", { name: "Back to live camera" })).toHaveCount(0);
  await page.getByRole("button", { name: "Scan again", exact: true }).click();
  await expect(page.getByLabel("Live camera scanner")).toBeVisible();
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

test("saved-photo canvas keeps the approved light palette across system themes", async ({ page }) => {
  await page.route("**/api/recognize", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ detections: [], message: "Not sure — point closer" })
    });
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await unlock(page);
  await chooseSavedPhoto(page, "dark-mode-shelf.png");

  const stage = page.getByLabel("Saved shelf or checkout photo scanner").locator(":scope > div").first();
  await expect(stage).toHaveCSS("background-color", "rgb(242, 242, 247)");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(stage).toHaveCSS("background-color", "rgb(242, 242, 247)");
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
  await expect(page.getByRole("button", { name: "Scan again", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("camera and results fit iPhone 17 Pro and adjacent iPhone viewports", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await unlock(page);
  await expectOfficialSugarNoLogo(page);
  await openDemoScene(page, "Shelf demo");
  await expect(page.getByRole("status")).toContainText("4 products · 4 with Sugar.no fit");

  const sheet = page.locator("aside");
  const status = page.getByRole("status");
  const viewAll = page.getByRole("button", { name: "View all", exact: true });
  const cameraViewport = page.getByTestId("camera-viewport");

  await expect(cameraViewport).toHaveCSS("overflow", "hidden");
  const cameraViewportBox = await cameraViewport.boundingBox();
  expect(cameraViewportBox?.x).toBe(0);
  expect(cameraViewportBox?.y).toBeGreaterThanOrEqual(80);
  expect((cameraViewportBox?.x ?? 0) + (cameraViewportBox?.width ?? 0)).toBeLessThanOrEqual(402);
  expect(parseFloat(await cameraViewport.evaluate((element) => getComputedStyle(element).borderRadius))).toBe(0);

  await expectInsideViewport(page, sheet);
  await expectInsideViewport(page, status);
  await expectInsideViewport(page, viewAll);
  expect((await viewAll.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole("button", { name: "Scan again" })).toBeVisible();
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: "test-results/iphone-17-pro-camera.png" });

  await viewAll.click();
  const dialog = page.getByRole("dialog", { name: "Products from this scan" });
  await expectInsideViewport(page, dialog);
  await expect(page.getByRole("button", { name: "Return to camera" })).toHaveCount(0);
  await expectInsideViewport(page, page.getByRole("button", { name: "Collapse product results" }));
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: "test-results/iphone-17-pro-results.png" });

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
    await expectInsideViewport(page, status);
    await expectInsideViewport(page, page.getByRole("button", { name: "View all", exact: true }));
    await expect(page.getByRole("button", { name: "Scan again" })).toBeVisible();
    await expectNoDocumentOverflow(page);
    if (viewport.label === "iPhone 17 Pro landscape") {
      await page.screenshot({ path: "test-results/iphone-17-pro-landscape.png" });
    }
    await page.getByRole("button", { name: "View all", exact: true }).click();
  }
});

test("scanner shell and results remain usable across the supported phone and tablet matrix", async ({ page }) => {
  test.setTimeout(90_000);
  await mockSampleShelfRecognition(page);
  const viewports = [
    { width: 375, height: 667, label: "iPhone SE" },
    { width: 402, height: 874, label: "iPhone 17 Pro" },
    { width: 440, height: 956, label: "iPhone Pro Max" },
    { width: 412, height: 915, label: "Pixel 7" },
    { width: 360, height: 780, label: "Galaxy S" },
    { width: 768, height: 1024, label: "iPad portrait" },
    { width: 874, height: 402, label: "iPhone landscape" },
    { width: 915, height: 412, label: "Pixel landscape" },
    { width: 1024, height: 768, label: "iPad landscape" }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await unlock(page);
    await openDemoScene(page, "Shelf demo");

    const cameraViewport = page.getByTestId("camera-viewport");
    await expectInsideViewport(page, cameraViewport);
    await expectInsideViewport(page, page.getByRole("button", { name: "View all", exact: true }));
    await expectNoDocumentOverflow(page);
    await expectVisibleTouchTargets(page);

    await page.getByRole("button", { name: "View all", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Products from this scan" });
    await expectInsideViewport(page, dialog);
    await expectInsideViewport(page, page.getByRole("button", { name: "Collapse product results" }));
    await expectNoDocumentOverflow(page);
    await expectVisibleTouchTargets(page);

    await test.info().attach(`${viewport.label} layout`, {
      body: await page.screenshot(),
      contentType: "image/png"
    });
  }
});

test("scanner reflows with large text in light and dark themes", async ({ page }) => {
  await mockSampleShelfRecognition(page);
  await page.addInitScript(() => {
    document.documentElement.style.setProperty("-webkit-text-size-adjust", "200%");
    document.documentElement.style.setProperty("text-size-adjust", "200%");
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await unlock(page);
  await openDemoScene(page, "Shelf demo");
  await expectNoDocumentOverflow(page);
  await expectVisibleTouchTargets(page);
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expectNoDocumentOverflow(page);
  await expectVisibleTouchTargets(page);

  await page.emulateMedia({ contrast: "more" });
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("live camera fills the screen while preserving capture geometry and aligned overlays", async ({ page }) => {
  test.setTimeout(45_000);
  await mockLiveCamera(page);
  let capturedFrame: string | null = null;
  await page.route("**/api/recognize", async (route) => {
    const body = route.request().postDataJSON() as { source?: string; imageDataUrl?: string } | null;
    if (body?.source === "camera" && body.imageDataUrl && !capturedFrame) {
      capturedFrame = body.imageDataUrl;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "camera-geometry",
        status: "matched",
        detections: [{
          productId: "barbora:geometry-test", confidence: .99,
          box: { x: .1, y: .2, width: .3, height: .4 }, observedText: "Geometry test",
          inlineProduct: ratedInlineProduct({ id: "barbora:geometry-test", brand: "Geometry", name: "Test bar", score: 70, protein: 20, sugar: 2 })
        }],
        latencyMs: 1,
        model: "qa-mock",
        imageStored: false
      })
    });
  });

  await unlock(page);
  const video = page.getByLabel("Live camera preview");
  await expect.poll(async () => video.evaluate((element) => (element as HTMLVideoElement).videoHeight)).toBe(960);
  await expect.poll(() => capturedFrame, { timeout: 5_000 }).not.toBeNull();
  const frameDataUrl: unknown = capturedFrame;
  if (typeof frameDataUrl !== "string") throw new Error("The live camera did not produce a JPEG frame");
  const capturedSize = await page.evaluate(async (dataUrl) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  }, frameDataUrl);
  expect(capturedSize).toEqual({ width: 640, height: 960 });

  const viewports = [
    { width: 375, height: 667, label: "iPhone SE" },
    { width: 402, height: 874, label: "iPhone 17 Pro" },
    { width: 440, height: 956, label: "iPhone Pro Max" },
    { width: 412, height: 915, label: "Pixel 7" },
    { width: 360, height: 780, label: "Galaxy S" },
    { width: 768, height: 1024, label: "iPad" },
    { width: 874, height: 402, label: "phone landscape" }
  ];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const frame = page.getByTestId("camera-viewport");
    await expectInsideViewport(page, frame);
    const initialBox = await frame.boundingBox();
    expect(initialBox?.x).toBeLessThanOrEqual(1);
    expect(initialBox?.y).toBe(0);
    expect(Math.abs((initialBox?.width ?? 0) - viewport.width)).toBeLessThanOrEqual(1);
    expect(Math.abs((initialBox?.height ?? 0) - viewport.height)).toBeLessThanOrEqual(1);
    await page.waitForTimeout(100);
    const stableBox = await frame.boundingBox();
    expect(Math.abs((initialBox?.width ?? 0) - (stableBox?.width ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((initialBox?.height ?? 0) - (stableBox?.height ?? 0))).toBeLessThanOrEqual(1);
    const geometry = await page.evaluate(() => {
      const frame = document.querySelector<HTMLElement>('[data-testid="camera-viewport"]');
      const video = document.querySelector<HTMLVideoElement>('video[aria-label="Live camera preview"]');
      if (!frame || !video) throw new Error("Live camera preview is unavailable");
      const rect = frame.getBoundingClientRect();
      const style = getComputedStyle(video);
      const logo = document.querySelector<HTMLImageElement>('header img[alt="Sugar.no"]');
      const captured = document.querySelector<HTMLElement>('[data-testid="captured-camera-frame"]');
      const marker = document.querySelector<HTMLElement>('[data-testid="rated-detection-marker"]');
      if (!logo || !captured || !marker) throw new Error("Camera overlays are unavailable");
      const markerRect = marker.getBoundingClientRect();
      const scale = Math.max(rect.width / video.videoWidth, rect.height / video.videoHeight);
      const renderedWidth = video.videoWidth * scale;
      const renderedHeight = video.videoHeight * scale;
      const left = Math.max(0, (rect.width - renderedWidth) / 2 + .1 * renderedWidth);
      const top = Math.max(0, (rect.height - renderedHeight) / 2 + .2 * renderedHeight);
      const right = Math.min(rect.width, (rect.width - renderedWidth) / 2 + .4 * renderedWidth);
      const bottom = Math.min(rect.height, (rect.height - renderedHeight) / 2 + .6 * renderedHeight);
      return {
        objectFit: style.objectFit,
        pointerEvents: style.pointerEvents,
        filter: style.filter,
        controls: video.controls,
        capturedFit: getComputedStyle(captured).objectFit,
        logoFilter: getComputedStyle(logo).filter,
        headerBackground: getComputedStyle(logo.closest("header")!).backgroundColor,
        marker: { x: markerRect.x, y: markerRect.y, width: markerRect.width, height: markerRect.height },
        expectedMarker: { x: left, y: top, width: right - left, height: bottom - top }
      };
    });
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(geometry.marker[key] - geometry.expectedMarker[key])).toBeLessThanOrEqual(1);
    }
    expect(geometry.objectFit).toBe("cover");
    expect(geometry.capturedFit).toBe("cover");
    expect(geometry.logoFilter).toBe("none");
    expect(geometry.headerBackground).toBe("rgba(0, 0, 0, 0)");
    expect(geometry.controls).toBe(false);
    expect(geometry.pointerEvents).toBe("none");
    expect(geometry.filter).toBe("none");
    await expect(page.getByText(/The scan starts automatically/)).toHaveCount(0);
    await expectInsideViewport(page, page.getByRole("button", { name: "Show demo" }));
    await expectInsideViewport(page, page.getByRole("button", { name: "Leave feedback" }));
    await expectNoDocumentOverflow(page);
    await expectVisibleTouchTargets(page);
    if (viewport.width === 402 || viewport.width === 874) {
      await page.screenshot({ path: `test-results/fullscreen-camera-${viewport.width}.png` });
    }
  }
});

test("fullscreen camera keeps its overlay controls and reading status clear on small and rotated phones", async ({ page }) => {
  await mockLiveCamera(page);
  let releaseRecognition!: () => void;
  const recognitionGate = new Promise<void>((resolve) => { releaseRecognition = resolve; });
  await page.route("**/api/recognize", async (route) => {
    await recognitionGate;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ requestId: "layout-only", status: "not_sure", detections: [], latencyMs: 1, model: "qa-mock", imageStored: false })
    });
  });
  await unlock(page);
  await expect(page.getByTestId("captured-camera-frame")).toBeVisible();
  try {
    for (const viewport of [{ width: 320, height: 568 }, { width: 402, height: 874 }, { width: 874, height: 402 }]) {
      await page.setViewportSize(viewport);
      const status = page.getByRole("status").filter({ hasText: "Reading visible products" });
      await expect(status).toBeVisible();
      await expectInsideViewport(page, status);
      const layout = await page.evaluate(() => {
        const logo = document.querySelector('header img[alt="Sugar.no"]')!;
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).filter(
          (button) => ["Show demo", "Leave feedback"].includes(button.textContent!.trim())
        );
        const status = document.querySelector('[role="status"]')!;
        const rects = [logo, ...buttons, status].map((element) => element.getBoundingClientRect());
        return {
          overlapping: rects.some((rect, index) => rects.slice(index + 1).some((other) =>
            rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top
          )),
          obstructed: buttons.some((button) => {
            const rect = button.getBoundingClientRect();
            return !button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
          }),
          statusColor: getComputedStyle(status).color,
          statusBackground: getComputedStyle(status).backgroundColor
        };
      });
      expect(layout.overlapping).toBe(false);
      expect(layout.obstructed).toBe(false);
      expect(layout.statusColor).toBe("rgb(255, 255, 255)");
      expect(layout.statusBackground).toBe("rgba(34, 34, 40, 0.93)");
      await expect(page.getByText(/The scan starts automatically/)).toHaveCount(0);
      await expectNoDocumentOverflow(page);
      await page.screenshot({ path: `test-results/fullscreen-camera-reading-${viewport.width}.png` });
    }
    await page.getByRole("button", { name: "Show demo" }).click();
    await expect(page.getByRole("dialog", { name: "See how a shelf scan works" })).toBeVisible();
  } finally {
    releaseRecognition();
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
  await expect(page.getByRole("status")).toContainText("We couldn’t finish this scan");
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
  await expect(page.getByAltText("Uploaded product scene")).toHaveCSS("object-fit", "contain");
  await expectInsideViewport(page, page.getByTestId("camera-viewport"));
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Salty Peanut", exact: true })).toBeVisible();
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
  const uploadedViewport = page.getByTestId("camera-viewport");
  await expect(page.getByAltText("Uploaded product scene")).toHaveCSS("object-fit", "contain");
  await expectInsideViewport(page, uploadedViewport);
  expect(recognitionRequests).toBe(4);
  const ranking = resultsDialog.getByLabel("Products ranked by Sugar.no fit");
  await expect(ranking.getByRole("button")).toHaveCount(3);
  await expect(ranking.getByRole("button", { name: /BALTAIS Protein Fit peach 300g/ })).toHaveCount(1);
  await expect(ranking.getByRole("button", { name: /BALTAIS Protein Fit Stracciatella 200g/ })).toHaveCount(1);
  await expect(ranking.getByRole("button", { name: /JUNGLE POP Kiwi jelly 115g/ })).toHaveCount(1);
  await expect(page.getByTestId("scan-guide")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Best fit first" })).toBeVisible();
});

test("confidently named products remain visible when exact nutrition is unavailable", async ({ page }) => {
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
  const resultsDialog = page.getByRole("dialog", { name: "Products from this scan" });
  await expect(resultsDialog).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("rated-detection-marker")).toHaveCount(0);
  await expect(page.getByLabel("Shelf marker legend")).toHaveCount(0);
  const ranking = resultsDialog.getByLabel("Products ranked by Sugar.no fit");
  await expect(ranking.getByRole("button")).toHaveCount(2);
  await expect(ranking.getByText("QA protein only", { exact: true })).toBeVisible();
  await expect(ranking.getByText("QA identity only", { exact: true })).toBeVisible();
  await expect(ranking.getByText("Nutrition not verified online", { exact: true })).toHaveCount(2);
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
    const detection = detections[0];
    const identity = detection.identity as { name?: string };
    const isSproud = identity.name?.includes("Sproud");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        latencyMs: 700,
        imageStored: false,
        detections: isSproud ? [
          {
            ...detection,
            productId: "web:sproud-barista-1l",
            identity: { ...(detection.identity as object), matchKind: "web_search" },
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
          }
        ] : detections
      })
    });
  });

  await unlock(page);
  await expect(page.getByRole("status")).toContainText("2 products · 1 with Sugar.no fit", { timeout: 8_000 });
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByText("1 of 2 ready to compare", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Best fit first" })).toBeVisible();
  await expect(page.getByLabel("Products ranked by Sugar.no fit").getByText("Other Snack", { exact: true })).toBeVisible();
  await expect(page.getByText("Nutrition not verified online", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Products ranked by Sugar.no fit").getByRole("button", { name: /Sproud Barista 1L/ })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan nutrition label" })).toHaveCount(0);
});

test("a broad live shelf scan keeps several different Sugar.no-rated products in one result", async ({ page }) => {
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
        detections
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

  await expect(page.getByRole("status")).toContainText("3 products · 3 with Sugar.no fit", { timeout: 10_000 });
  expect(recognitionAttempts).toBe(1);
  expect(focusModes).toEqual([false]);
  const scanner = page.getByLabel("Live camera scanner");
  await expect(scanner.locator('button[aria-label^="Open "]')).toHaveCount(3);
  await expect(page.getByRole("status")).toContainText("3 products · 3 with Sugar.no fit");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByLabel("Products ranked by Sugar.no fit").getByRole("button")).toHaveCount(3);
});

test("live camera applies each online result without waiting for the slowest product", async ({ page }) => {
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
  let releaseSlowEnrichment!: () => void;
  let slowEnrichmentFinished = false;
  const slowEnrichmentGate = new Promise<void>((resolve) => {
    releaseSlowEnrichment = resolve;
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
    const { detections: requested } = route.request().postDataJSON() as { detections: typeof detections };
    expect(requested).toHaveLength(1);
    const requestedDetection = requested[0];
    const isFastProduct = requestedDetection.productId === "visual:cola";
    if (!isFastProduct) {
      await slowEnrichmentGate;
      slowEnrichmentFinished = true;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        detections: isFastProduct
          ? [{
              ...requestedDetection,
              productId: "web:cola",
              identity: { ...requestedDetection.identity, matchKind: "web_search" },
              inlineProduct: ratedInlineProduct({
                id: "web:cola",
                brand: "Coca-Cola",
                name: "Coca-Cola Original 330 ml",
                score: 20,
                protein: 0,
                sugar: 10.6
              })
            }]
          : requested,
        latencyMs: isFastProduct ? 800 : 3_000,
        imageStored: false
      })
    });
  });

  await unlock(page);
  const liveCameraVideo = page.getByLabel("Live camera preview");
  await expect.poll(async () => liveCameraVideo.evaluate((video) => (video as HTMLVideoElement).videoHeight)).toBe(960);
  const previewGeometry = await page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>('[data-testid="camera-viewport"]');
    const video = document.querySelector<HTMLVideoElement>('video[aria-label="Live camera preview"]');
    if (!viewport || !video) throw new Error("Live camera preview is unavailable");
    const viewportRect = viewport.getBoundingClientRect();
    return {
      viewportRatio: viewportRect.width / viewportRect.height,
      screenRatio: window.innerWidth / window.innerHeight,
      objectFit: getComputedStyle(video).objectFit,
      pointerEvents: getComputedStyle(video).pointerEvents,
      borderRadius: parseFloat(getComputedStyle(viewport).borderRadius)
    };
  });
  expect(previewGeometry.viewportRatio).toBeCloseTo(previewGeometry.screenRatio, 2);
  expect(previewGeometry.objectFit).toBe("cover");
  expect(previewGeometry.pointerEvents).toBe("none");
  expect(previewGeometry.borderRadius).toBe(0);
  const cameraConstraints = await page.evaluate(
    () => (window as Window & { __cameraConstraints?: MediaStreamConstraints }).__cameraConstraints
  );
  expect(cameraConstraints).toMatchObject({
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 30 }
    }
  });
  const preview = page.getByLabel("Product result preview");
  await expect(preview.getByText("Checking nutrition…", { exact: true })).toHaveCount(1, { timeout: 5_000 });
  await expect(preview.getByText("Low fit", { exact: true })).toBeVisible();
  expect(slowEnrichmentFinished).toBe(false);
  releaseSlowEnrichment();
  await expect.poll(() => slowEnrichmentFinished).toBe(true);
  await expect(preview.getByText("Checking nutrition…", { exact: true })).toHaveCount(0);
  await expect(preview.locator("article")).toHaveCount(2);
  await expect(preview.getByRole("button", { name: /Sanpellegrino Zero 330 ml/ })).toBeVisible();
  await expect(preview.getByText("Nutrition not verified", { exact: true })).toBeVisible();
});

test("a visual-only live result holds the captured frame without scanning a new scene", async ({ page }) => {
  await mockLiveCamera(page);
  let recognitionRequests = 0;
  const focusModes: boolean[] = [];
  await page.route("**/api/recognize", async (route) => {
    recognitionRequests += 1;
    const request = route.request().postDataJSON() as { focusMode?: boolean };
    focusModes.push(Boolean(request.focusMode));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "visual-only-product",
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
          retailerOffer: null,
          inlineProduct: null
        }]
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
  await expect.poll(() => recognitionRequests, { timeout: 10_000 }).toBe(1);
  await expect(page.getByLabel("Live camera scanner")).toBeVisible();
  await expect(page.getByTestId("captured-camera-frame")).toBeVisible();
  expect(focusModes).toEqual([false]);
  await page.waitForTimeout(2_000);
  expect(recognitionRequests).toBe(1);
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("heading", { name: "First Product" })).toBeVisible();
  await expect(page.getByText("Nutrition not verified", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan nutrition label" })).toHaveCount(0);
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
  const retryButton = page.getByRole("button", { name: "Not sure — try again", exact: true });
  await expect(retryButton).toBeVisible({ timeout: 6_000 });
  await expect(page.getByRole("status")).toContainText("We couldn’t finish this scan");
  await expectInsideViewport(page, retryButton);
  await page.screenshot({ path: "test-results/pen-service-unavailable.png" });
  await expect(page.getByRole("button", { name: "Show demo" })).toBeVisible();
  await page.waitForTimeout(2_500);
  expect(recognitionRequests).toBe(1);
});

test("HTTP 429 pauses automatic recognition and offers manual recovery", async ({ page }) => {
  await mockLiveCamera(page);
  let recognitionRequests = 0;
  await page.route("**/api/recognize", async (route) => {
    recognitionRequests += 1;
    await route.fulfill({
      status: 429,
      headers: { "Retry-After": "7" },
      contentType: "application/json",
      body: JSON.stringify({ error: "rate_limited" })
    });
  });

  await unlock(page);
  await expect(page.getByRole("button", { name: "Not sure — try again", exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Show demo" })).toBeVisible();
  await page.waitForTimeout(2_500);
  expect(recognitionRequests).toBe(1);
});

test("live camera groups repeated packs and holds the captured scene until Scan again", async ({ page }) => {
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
  await expect(page.getByTestId("captured-camera-frame")).toBeVisible();
  await expect(page.getByLabel("Live camera preview")).toBeVisible();
  await expect(page.getByLabel("Live camera scanner").locator('button[aria-label^="Open "]')).toHaveCount(1);
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Coca-Cola Original Taste/ })).toBeVisible();
  const scanAgainButton = page.getByRole("button", { name: "Scan again" });
  await expect(scanAgainButton).toBeVisible();
  const scanAgainBox = await scanAgainButton.boundingBox();
  expect(scanAgainBox?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByLabel("Products ranked by Sugar.no fit")).toHaveCount(0);
  await page.waitForTimeout(2_500);
  expect(recognitionRequests).toBe(1);
  expect(focusModes).toEqual([false]);

  currentProduct = "activia";
  await page.evaluate(() => {
    (window as Window & { __cameraScene?: number }).__cameraScene = 1;
  });
  await page.waitForTimeout(2_500);
  expect(recognitionRequests).toBe(1);
  await expect(page.getByRole("heading", { name: /Coca-Cola Original Taste/ })).toBeVisible();
  await scanAgainButton.click();
  await expect(page.getByRole("status")).toContainText("1 product · 1 with Sugar.no fit", { timeout: 10_000 });
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Activia Forest Berries Yogurt/ })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: /Coca-Cola Original Taste/ })).toHaveCount(0);
  expect(recognitionRequests).toBe(2);
  expect(focusModes).toEqual([false, false]);
});

test("a rated product receives an honest price comparison", async ({ page }) => {
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
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Zero Peach.*Pesca & Clementina.*330 ml/ })).toBeVisible();
  await expect(page.getByLabel("Saved shelf or checkout photo scanner").locator('button[aria-label^="Open "]')).toHaveCount(1);
  await expect(page.getByLabel("Shelf marker legend")).toHaveCount(0);
  await expect(page.getByLabel("Price comparison")).toHaveCount(0);
  const inlineOffer = page.getByRole("link", { name: /Buy cheaper online Zero Peach.* at Barbora/ });
  await expect(inlineOffer).toHaveAttribute(
    "href",
    "https://barbora.lv/produkti/gaz-dz-sanpellegrino-zero-peach-0-33-l-d"
  );
  await expect(page.getByRole("region", { name: "Product price" })).toContainText("Buy cheaper online");
  await expect(page.getByRole("region", { name: "Product price" })).toContainText("€0.99");
  await expect(inlineOffer.getByText("€1.69 shelf", { exact: true })).toHaveCount(0);
  const expandedPrice = page.getByLabel("Shelf price €1.69, online price €0.99, cheaper online").last();
  await expect(expandedPrice.getByText("€1.69", { exact: true })).toHaveCSS("text-decoration-line", "line-through");
  await expect(expandedPrice.locator("strong")).toHaveText("€0.99");
  await expect(inlineOffer.getByRole("group", { name: "Shelf price €1.69, online price €0.99, cheaper online" })).toBeVisible();
  expect((await inlineOffer.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  const inlineOfferBox = await inlineOffer.boundingBox();
  const inlineOfferCardBox = await inlineOffer.locator("..").boundingBox();
  expect(inlineOfferBox?.width ?? 0).toBeGreaterThan((inlineOfferCardBox?.width ?? 0) - 42);
  await expect(page.getByText("Nutrition not verified online", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Scan nutrition label" })).toHaveCount(0);
  await expect(page.getByText("How this result was made", { exact: true })).toHaveCount(0);
  await inlineOffer.screenshot({ path: "test-results/price-comparison-mobile.png" });

  exactSku = false;
  await page.getByRole("button", { name: "Collapse product results" }).click();
  await page.getByRole("button", { name: "Scan again", exact: true }).click();
  await chooseSavedPhoto(page, "possible-price-check.png");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByLabel("Price comparison")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Buy cheaper online/ })).toHaveCount(0);
  await expect(page.getByLabel("Product result preview").getByRole("link", { name: /Buy .* cheaper at Barbora/ })).toHaveCount(0);

  exactSku = true;
  includeShelfPrice = false;
  await page.getByRole("button", { name: "Collapse product results" }).click();
  await page.getByRole("button", { name: "Scan again", exact: true }).click();
  await chooseSavedPhoto(page, "package-without-shelf-label.png");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByLabel("Price comparison")).toHaveCount(0);
  await expect(page.getByLabel(/Shelf price €/)).toHaveCount(0);
  await expect(page.getByText(/Keep the package and its shelf label/)).toHaveCount(0);
  await expect(page.getByLabel("Product result preview").getByRole("link", { name: /Buy .* cheaper at Barbora/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Buy online Zero Peach.* at Barbora for €0\.99/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Buy cheaper online Zero Peach.* at Barbora for €0\.99/ })).toHaveCount(0);
  await expect(page.getByText("Barbora online", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Online price €0.99")).toBeVisible();
  await expect(page.getByRole("link", { name: /Buy cheaper online/ })).toHaveCount(0);
  await expect(page.locator('[aria-label*="Barbora online"]')).toHaveCount(0);
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
  await expect(page.getByText("Checking nutrition…", { exact: true })).toBeVisible();
  const cameraOverlay = page.getByLabel("Saved shelf or checkout photo scanner");
  const ratedMarker = cameraOverlay.locator('button[aria-label^="Open "]').first();
  await expect(ratedMarker).toBeVisible();
  await expect(ratedMarker.locator('svg[data-fit-icon="low"]')).toHaveCount(1);
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
  await expect(badge.getByText("Sugar.no fit · exact product data", { exact: true })).toBeVisible();
  await expect(badge.getByText("22 g", { exact: true })).toBeVisible();
  await expect(badge.getByText("14 g", { exact: true })).toBeVisible();
  await expect(badge.getByText("Fiber", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Per 100 g · exact product data", { exact: true })).toBeVisible();
  await expect(page.getByText("Best fit in this scan", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Data sources and limits", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "test-results/barbora-quick-view-mobile.png" });
  await page.emulateMedia({ contrast: "more" });
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("entry retains approved colors and passes WCAG with increased contrast", async ({ page }) => {
  await unlock(page);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(150);
  const normal = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  // Only the two approved blue labels may fall below AA in normal mode.
  expect(normal.violations.every((violation) => violation.id === "color-contrast" && violation.nodes.every((node) =>
    node.target.every((target) => /feedbackTrigger|secondaryButton/.test(String(target)))
  ))).toBe(true);
  await page.emulateMedia({ contrast: "more" });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("Pen feedback keeps the answer through saving, failure and retry", async ({ page }) => {
  let release: (() => void) | undefined;
  let attempt = 0;
  await page.route("**/api/feedback", async (route) => {
    attempt += 1;
    expect(route.request().postDataJSON()).toMatchObject({ helpful: false, reason: "unclear", comment: "The label was hard to read" });
    if (attempt === 1) {
      await new Promise<void>((resolve) => { release = resolve; });
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporary" }) });
    } else {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
  });
  await unlock(page);
  await openDemoScene(page, "Shelf demo");
  const trigger = page.getByRole("button", { name: "Leave feedback", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Was this scan helpful?" });
  await page.screenshot({ path: "test-results/pen-feedback-initial.png" });
  await dialog.getByRole("button", { name: "Needs work" }).click();
  await dialog.getByLabel("Result was unclear").check();
  await dialog.getByPlaceholder("Tell us what you noticed").fill("The label was hard to read");
  await page.screenshot({ path: "test-results/pen-feedback-needs-work.png" });
  await dialog.getByRole("button", { name: "Send feedback" }).click();
  await expect(dialog.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Close feedback" })).toBeDisabled();
  await expect(dialog.getByPlaceholder("Tell us what you noticed")).toBeDisabled();
  await page.screenshot({ path: "test-results/pen-feedback-saving.png" });
  await expect.poll(() => Boolean(release)).toBe(true);
  release!();
  await expect(dialog.getByRole("alert")).toContainText("Couldn’t save feedback");
  await expect(dialog.getByPlaceholder("Tell us what you noticed")).toHaveValue("The label was hard to read");
  await page.screenshot({ path: "test-results/pen-feedback-error.png" });
  await dialog.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();
  await page.screenshot({ path: "test-results/pen-feedback-success.png" });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(trigger).toBeFocused();
  expect(attempt).toBe(2);
});

test("saved-photo recovery retries the same prepared image without reopening the camera", async ({ page }) => {
  const submittedImages: string[] = [];
  let finishFirstRead: (() => void) | undefined;
  await page.route("**/api/recognize", async (route) => {
    const request = route.request().postDataJSON() as { source: string; imageDataUrl: string };
    expect(request.source).toBe("upload");
    submittedImages.push(request.imageDataUrl);
    const recovered = submittedImages.length > 1;
    if (!recovered) await new Promise<void>((resolve) => { finishFirstRead = resolve; });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      requestId: "retry-upload", status: recovered ? "matched" : "provider_unavailable", latencyMs: 1, model: "qa-mock", imageStored: false,
      detections: recovered ? [{ productId: "barbora:upload-retry", confidence: .99, box: { x: .1, y: .1, width: .7, height: .7 }, observedText: "Retry test", inlineProduct: ratedInlineProduct({ id: "barbora:upload-retry", brand: "Example", name: "Retry test", score: 80, protein: 20, sugar: 2 }) }] : []
    }) });
  });
  await unlock(page);
  await chooseSavedPhoto(page);
  await expect(page.getByRole("heading", { name: "Read a saved photo", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Reading the full image and close-up sections");
  await expect(page.getByText("Photos are not saved.", { exact: true })).toHaveCount(0);
  await expect.poll(() => Boolean(finishFirstRead)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("saved-photo-without-footer.png"), animations: "disabled" });
  finishFirstRead!();
  await expect(page.getByRole("status")).toContainText("We couldn’t finish this scan");
  await page.getByRole("button", { name: "Not sure — try again", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("1 product · 1 with Sugar.no fit");
  expect(submittedImages).toHaveLength(2);
  expect(submittedImages[1]).toBe(submittedImages[0]);
  await expect(page.getByLabel("Saved shelf or checkout photo scanner")).toBeVisible();
  await expect(page.getByText("Photos are not saved.", { exact: true })).toHaveCount(0);
});
