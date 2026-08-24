import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function unlock(page: Page) {
  await page.goto("/");
  await expect(page.getByLabel("Live camera scanner")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show demo" })).toBeVisible();
}

async function openDemoScene(page: Page, name: "Shelf demo" | "Checkout demo") {
  await page.getByRole("button", { name: "Show demo" }).click();
  const chooser = page.getByRole("dialog", { name: "See how a shelf scan works" });
  await expect(chooser).toBeVisible();
  await chooser.getByRole("button", { name: new RegExp(name) }).click();
}

async function waitForAlternativeImages(page: Page) {
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll<HTMLImageElement>('img[alt=""]')];
    return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0);
  });
}

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

async function chooseSavedPhoto(page: Page, name = "qa-shelf.png") {
  await page.getByRole("button", { name: "Show demo" }).click();
  const chooser = page.getByRole("dialog", { name: "See how a shelf scan works" });
  await expect(chooser).toBeVisible();
  await chooser.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "image/png",
    buffer: onePixelPng
  });
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
  await expect(page.getByText("Camera permission is off")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable camera" })).toBeVisible();
  await page.goto("/access");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("Investor access code")).toHaveCount(0);
  await expect(page.getByText("Private demo", { exact: true })).toHaveCount(0);
});

test("sample shelf photo highlights products and shows a three-signal Sugar.no badge", async ({ page }) => {
  await unlock(page);
  await openDemoScene(page, "Shelf demo");
  await expect(page.getByRole("status")).toContainText("4 products · 4 with Sugar.no fit");
  await expect(page.getByLabel("Shelf photo scanner").locator('button[aria-label^="Open "]')).toHaveCount(4);
  await expect(page.getByRole("status")).toContainText("4 products · 4 with Sugar.no fit");
  await expect(page.getByLabel("Sample shelf photo with four supported protein snacks").locator("img")).toHaveCount(1);
  await expect(page.getByAltText("Four protein bars on a supermarket shelf")).toBeVisible();
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLImageElement>('div[aria-label="Sample shelf photo with four supported protein snacks"] img')]
      .every((image) => image.complete && image.naturalWidth > 0)
  );
  await waitForAlternativeImages(page);
  await page.screenshot({ path: "docs/screenshots/shelf-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "View all", exact: true }).click();
  const resultsDialog = page.getByRole("dialog", { name: "Products from this scan" });
  await expect(resultsDialog).toBeVisible();
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  await expect.poll(async () => (await resultsDialog.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(viewportHeight * 0.95);
  const bestFitHeading = page.getByText("Best fit in this scan", { exact: true });
  await expect(bestFitHeading).toBeVisible();
  await expect
    .poll(() =>
      bestFitHeading.evaluate((element) =>
        Boolean(element.parentElement?.querySelector("h2"))
      )
    )
    .toBe(true);
  await page.screenshot({ path: "docs/screenshots/shelf-results-mobile.png" });
  await expect(page.getByLabel("Sugar.no badge")).toBeVisible();
  await expect(page.getByLabel("Sugar.no badge").getByText("Protein", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Sugar.no badge").getByText("Fiber", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Sugar.no badge").getByText("Sugar", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Shelf marker legend").getByText("Great fit", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Shelf marker legend").getByText("Moderate fit", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Shelf marker legend").getByText("Low fit", { exact: true })).toBeVisible();
  await expect(page.getByText("Values per 100 g · Compared with protein snacks in this demo")).toBeVisible();
  await expect(page.getByText(/Sugar\.no Match \d+/)).toHaveCount(0);
  await expect(page.getByText("Data sources and limits", { exact: true })).toHaveCount(0);
  const retailer = page.getByRole("link", { name: /View at Barbora/ });
  await expect(retailer).toHaveAttribute("href", /^https:\/\/barbora\.lv\/produkti\//);
  await expect(page.getByText(/\b(good|bad|unhealthy)\b/i)).toHaveCount(0);
  await waitForAlternativeImages(page);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("checkout photo uses one multi-product scan instead of an animated product", async ({ page }) => {
  await unlock(page);
  await openDemoScene(page, "Checkout demo");
  await expect(page.getByRole("status")).toContainText("4 products · 4 with Sugar.no fit");
  await expect(page.getByLabel("Checkout photo scanner").locator('button[aria-label^="Open "]')).toHaveCount(4);
  await expect(page.getByAltText("Four protein bars on a supermarket checkout conveyor belt beside a cashier")).toBeVisible();
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLImageElement>('div[aria-label="Real supermarket checkout belt sample with four supported protein snacks"] img')]
      .every((image) => image.complete && image.naturalWidth > 0)
  );
  await waitForAlternativeImages(page);
  await page.screenshot({ path: "docs/screenshots/checkout-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "View all", exact: true }).click();
  const tray = page.getByLabel("Products in this scan");
  await expect(tray).toBeVisible({ timeout: 8_000 });
  await expect(tray.getByRole("button")).toHaveCount(4);
  await expect(page.getByText("Compare without starting over")).toBeVisible();
  await expect(page.getByRole("button", { name: /save/i })).toHaveCount(0);
  await waitForAlternativeImages(page);
});

test("demo chooser supports shelf, checkout and a clear return to live camera", async ({ page }) => {
  await unlock(page);
  await openDemoScene(page, "Shelf demo");
  await expect(page.getByRole("status")).toContainText("4 products · 4 with Sugar.no fit");
  await page.getByRole("button", { name: "Back to live camera" }).click();
  await expect(page.getByLabel("Live camera scanner")).toBeVisible();
  await openDemoScene(page, "Checkout demo");
  await expect(page.getByRole("status")).toContainText("4 products · 4 with Sugar.no fit");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByText("Compare without starting over")).toBeVisible();
  await expect(page.getByRole("button", { name: /save/i })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Saved options" })).toHaveCount(0);
  await page.getByRole("button", { name: "Return to camera" }).click();
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
  await expect(page.getByLabel("Sugar.no badge")).toBeVisible();
  await expect(page.getByRole("button", { name: /save/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("scanner remains operable at narrow portrait and phone landscape sizes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await unlock(page);
  await openDemoScene(page, "Shelf demo");
  const portraitStage = page.getByLabel("Shelf photo scanner").locator(":scope > div").first();
  const portraitStageBox = await portraitStage.boundingBox();
  expect(portraitStageBox?.height).toBeGreaterThanOrEqual(812 * 0.95);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByLabel("Sugar.no badge")).toBeVisible();

  await page.setViewportSize({ width: 812, height: 375 });
  await expect(page.getByLabel("Sugar.no badge")).toBeVisible();
  await page.getByRole("button", { name: "Collapse product results" }).click();
  await expect(page.getByRole("button", { name: "Back to live camera" })).toBeVisible();
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
});

for (const scenario of [
  {
    name: "protein and fiber",
    mask: ["protein", "fiber"],
    nutrients: { proteinG: 24, fiberG: 8, totalSugarG: null },
    criteria: { protein: 100, fiber: 100, inverseSugar: null },
    missingCriterion: "Sugar",
    expectedCopy:
      "Protein and fiber are source-backed. Total sugar is not listed, so this is not the full three-signal fit."
  },
  {
    name: "protein and sugar",
    mask: ["protein", "inverseSugar"],
    nutrients: { proteinG: 24, fiberG: null, totalSugarG: 3 },
    criteria: { protein: 100, fiber: null, inverseSugar: 100 },
    missingCriterion: "Fiber",
    expectedCopy:
      "Protein and total sugar are source-backed. Fiber is not listed, so this is not the full three-signal fit."
  },
  {
    name: "fiber and sugar",
    mask: ["fiber", "inverseSugar"],
    nutrients: { proteinG: null, fiberG: 8, totalSugarG: 3 },
    criteria: { protein: null, fiber: 100, inverseSugar: 100 },
    missingCriterion: "Protein",
    expectedCopy:
      "Fiber and total sugar are source-backed. Protein is not listed, so this is not the full three-signal fit."
  }
] as const) {
  test(`partial quick view explains the actual ${scenario.name} signal mask`, async ({ page }) => {
    const productId = `barbora:qa-${scenario.name.replaceAll(" ", "-")}`;
    await page.route("**/api/recognize", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          requestId: `partial-${scenario.name}`,
          status: "matched",
          latencyMs: 800,
          model: "qa-mock",
          imageStored: false,
          detections: [
            {
              productId,
              catalogProductId: productId,
              confidence: 0.97,
              box: { x: 0.18, y: 0.16, width: 0.64, height: 0.68 },
              observedText: `QA ${scenario.name}`,
              identity: {
                brand: "QA",
                name: `QA ${scenario.name}`,
                variant: null,
                packSize: "100 g",
                category: "Snack",
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
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          product: {
            id: productId,
            retailerProductId: productId.slice("barbora:".length),
            brand: "QA",
            name: `QA ${scenario.name}`,
            shortName: `QA ${scenario.name}`,
            aliases: [],
            format: "other",
            packSizeG: 100,
            nutritionBasis: "100g",
            energyKcalPer100: 300,
            gtin: null,
            nutrientsPer100g: scenario.nutrients,
            noAddedSugarClaim: false,
            imageUrl: null,
            retailerUrl: `https://barbora.lv/produkti/${productId.slice("barbora:".length)}`,
            sources: [],
            isGolden: false,
            accent: "coral",
            matchScore: 100,
            matchReason: "partial_nutrition",
            ratingBasis: "barbora_reference_partial",
            ratingStatus: "partial_overall",
            ratingSignalCount: 2,
            ratingSignalMask: scenario.mask,
            criterionScores: scenario.criteria
          },
          alternatives: []
        })
      });
    });

    await unlock(page);
    await chooseSavedPhoto(page, `${scenario.name.replaceAll(" ", "-")}.png`);
    await expect(page.getByRole("status")).toContainText("1 product · 1 with Sugar.no fit", { timeout: 10_000 });
    await page.getByRole("button", { name: "View all", exact: true }).click();
    const badge = page.getByLabel("Sugar.no badge");
    await expect(badge.getByText("Sugar.no quick view · 2/3", { exact: true })).toBeVisible();
    await expect(badge.getByText(scenario.missingCriterion, { exact: true })).toBeVisible();
    await expect(badge.getByText("Not listed", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Quick view · 2 of 3 signals", { exact: true }).locator("..")
    ).toContainText(scenario.expectedCopy);
  });
}

test("one-signal and identity-only products remain neutral without an overall fit", async ({ page }) => {
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
          shelfPrice: null,
          retailerOffer: null
        }))
      })
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
          criterionScores: limited ? { protein: 100, fiber: null, inverseSugar: null } : null
        },
        alternatives: []
      })
    });
  });

  await unlock(page);
  await chooseSavedPhoto(page, "limited-and-identity.png");
  await expect(page.getByRole("status")).toContainText("2 products · 0 with Sugar.no fit");
  const scanner = page.getByLabel("Saved shelf or checkout photo scanner");
  await expect(scanner.locator('button[aria-label^="Open "]')).toHaveCount(0);
  await expect(page.getByLabel("Shelf marker legend")).toHaveCount(0);
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByText("No Sugar.no fit yet.", { exact: true })).toBeVisible();
  await expect(page.getByText(/available in the results without a camera marker/)).toBeVisible();
  await expect(page.getByText("Limited view · 1 of 3 signals", { exact: true })).toBeVisible();
  await expect(page.getByText("Best fit in this scan", { exact: true })).toHaveCount(0);
  await page.getByLabel("Products in this scan").getByRole("button", { name: /QA identity only/ }).click();
  await expect(page.getByText("Identified, not rated", { exact: true })).toBeVisible();
});

test("a broad live shelf scan keeps several different Sugar.no-rated products in one result", async ({ page }) => {
  await mockLiveCamera(page);
  await unlock(page);

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
        detections: recognitionAttempts === 1 ? detections.slice(0, 1) : detections
      })
    });
  });

  await expect(page.getByRole("status")).toContainText("1 product found. Scanning the rest of the shelf", {
    timeout: 6_000
  });
  await expect(page.getByRole("status")).toContainText("3 products · 3 with Sugar.no fit", { timeout: 10_000 });
  expect(recognitionAttempts).toBe(2);
  expect(focusModes).toEqual([false, false]);
  const scanner = page.getByLabel("Live camera scanner");
  await expect(scanner.locator('button[aria-label^="Open "]')).toHaveCount(3);
  await expect(page.getByRole("status")).toContainText("3 products · 3 with Sugar.no fit");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByLabel("Products in this scan").getByRole("button")).toHaveCount(3);
});

test("a not-sure shelf completion retry retains and locks the first valid product", async ({ page }) => {
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
  await page.waitForTimeout(2_500);
  expect(recognitionRequests).toBe(2);
  expect(focusModes).toEqual([false, false]);
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("heading", { name: "First Product" })).toBeVisible();
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
  await unlock(page);

  let currentProduct: "coke" | "activia" = "coke";
  let recognitionRequests = 0;
  const focusModes: boolean[] = [];
  await page.route("**/api/recognize", async (route) => {
    recognitionRequests += 1;
    const request = route.request().postDataJSON() as { focusMode?: boolean };
    focusModes.push(Boolean(request.focusMode));
    if (currentProduct === "coke" && !request.focusMode) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          requestId: `broad-not-sure-${recognitionRequests}`,
          status: "not_sure",
          latencyMs: 800,
          model: "gemini-3.7-flash",
          imageStored: false,
          detections: []
        })
      });
      return;
    }
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
        detections: identities.map((name, index) => ({
          productId: `visual:${name.toLowerCase().replaceAll(" ", "-")}`,
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
            matchKind: "visual_only"
          },
          shelfPrice: null,
          retailerOffer: null
        }))
      })
    });
  });

  await expect(page.getByRole("status")).toContainText("1 product · 0 with Sugar.no fit", { timeout: 10_000 });
  await expect(page.getByRole("status")).toContainText("1 product · 0 with Sugar.no fit");
  await expect(page.getByLabel("Live camera scanner").locator('button[aria-label^="Open "]')).toHaveCount(0);
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Coca-Cola Original Taste/ })).toBeVisible();
  await expect(page.getByText("No Sugar.no fit yet.")).toBeVisible();
  const scanAgainButton = page.getByRole("button", { name: "Scan again" });
  await expect(scanAgainButton).toBeVisible();
  const scanAgainBox = await scanAgainButton.boundingBox();
  expect(scanAgainBox?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByLabel("Products in this scan")).toHaveCount(0);
  await page.waitForTimeout(2_500);
  expect(recognitionRequests).toBe(2);
  expect(focusModes).toEqual([false, true]);

  currentProduct = "activia";
  await page.getByRole("button", { name: "Scan again" }).click();
  await expect(page.getByRole("status")).toContainText("1 product · 0 with Sugar.no fit", { timeout: 10_000 });
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Activia Forest Berries Yogurt/ })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: /Coca-Cola Original Taste/ })).toHaveCount(0);
  expect(recognitionRequests).toBe(3);
  expect(focusModes).toEqual([false, true, false]);
});

test("a product outside the scored catalog is named and receives an honest price comparison", async ({ page }) => {
  await unlock(page);
  await page.route("**/api/products/**", async (route) => {
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not_found" }) });
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
  await expect(page.getByRole("status")).toContainText("1 product · 0 with Sugar.no fit");
  await expect(
    page.getByLabel("Product result preview").getByLabel("Shelf price €1.69, Barbora €0.99, cheaper at Barbora")
  ).toBeVisible();
  const compactBuy = page.getByLabel("Product result preview").getByRole("link", {
    name: "Buy Zero Peach cheaper at Barbora for €0.99"
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
  await expect(page.getByLabel("Saved shelf or checkout photo scanner").locator('button[aria-label^="Open "]')).toHaveCount(0);
  await expect(page.getByLabel("Shelf marker legend")).toHaveCount(0);
  await expect(page.getByText("No Sugar.no fit yet.")).toBeVisible();
  const comparison = page.getByLabel("Price comparison");
  await expect(comparison.getByText("Cheaper at Barbora", { exact: true })).toBeVisible();
  await expect(comparison.getByText("€0.70 less")).toBeVisible();
  await expect(comparison.getByText("€1.69", { exact: true })).toHaveCSS("text-decoration-line", "line-through");
  await expect(comparison.getByRole("link", { name: /Buy cheaper at Barbora · €0.99/ })).toHaveAttribute(
    "href",
    "https://barbora.lv/produkti/gaz-dz-sanpellegrino-zero-peach-0-33-l-d"
  );
  await expect(page.getByText(/no health or Match score is invented/i)).toBeVisible();
  await expect(page.getByText("How this result was made", { exact: true })).toHaveCount(0);
  await comparison.scrollIntoViewIfNeeded();
  await comparison.screenshot({ path: "docs/screenshots/price-comparison-mobile.png" });

  exactSku = false;
  await page.getByRole("button", { name: "Return to camera" }).click();
  await page.getByRole("button", { name: "Back to live camera" }).click();
  await chooseSavedPhoto(page, "possible-price-check.png");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(comparison.getByText("Shelf price", { exact: true })).toBeVisible();
  await expect(comparison.getByText("Possible Barbora match")).toHaveCount(0);
  await expect(comparison.getByText("€1.69", { exact: true })).toHaveCSS("text-decoration-line", "none");
  await expect(comparison.getByText("Cheaper at Barbora", { exact: true })).toHaveCount(0);
  await expect(comparison.getByRole("link")).toHaveCount(0);
  await expect(page.getByLabel("Product result preview").getByRole("link", { name: /Buy .* cheaper at Barbora/ })).toHaveCount(0);

  exactSku = true;
  includeShelfPrice = false;
  await page.getByRole("button", { name: "Return to camera" }).click();
  await page.getByRole("button", { name: "Back to live camera" }).click();
  await chooseSavedPhoto(page, "package-without-shelf-label.png");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByLabel("Price comparison")).toHaveCount(0);
  await expect(page.getByLabel(/Shelf price €/)).toHaveCount(0);
  await expect(page.getByText(/Keep the package and its shelf label/)).toHaveCount(0);
  await expect(page.getByLabel("Product result preview").getByRole("link", { name: /Buy .* cheaper at Barbora/ })).toHaveCount(0);
});

test("an exact Barbora food gets an on-demand two-signal Sugar.no quick view", async ({ page }) => {
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
          matchReason: "partial_nutrition",
          ratingBasis: "barbora_reference_partial",
          ratingStatus: "partial_overall",
          ratingSignalCount: 2,
          ratingSignalMask: ["protein", "inverseSugar"],
          criterionScores: { protein: 55, fiber: null, inverseSugar: 20 }
        },
        alternatives: []
      })
    });
  });

  await page.waitForLoadState("networkidle");
  await chooseSavedPhoto(page, "exact-barbora-food.png");

  await expect(page.getByRole("status")).toContainText("Products found. Checking Sugar.no signals");
  await expect(page.getByText("Checking nutrition…", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Saved shelf or checkout photo scanner").locator('button[aria-label*="2/3 signals"]')).toHaveCount(1);
  await expect(page.getByRole("status")).toContainText("1 product · 1 with Sugar.no fit");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  const resultsDialog = page.getByRole("dialog", { name: "Products from this scan" });
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  await expect.poll(async () => (await resultsDialog.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(viewportHeight * 0.95);
  const badge = page.getByLabel("Sugar.no badge");
  await expect(badge.getByText("Sugar.no quick view · 2/3", { exact: true })).toBeVisible();
  await expect(badge.getByText("22g", { exact: true })).toBeVisible();
  await expect(badge.getByText("14g", { exact: true })).toBeVisible();
  await expect(badge.getByText("Not listed", { exact: true })).toBeVisible();
  await expect(page.getByText("Values per 100 g · 2 of 3 source-backed signals", { exact: true })).toBeVisible();
  await expect(page.getByText("Quick view · 2 of 3 signals", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Protein and total sugar are source-backed. Fiber is not listed, so this is not the full three-signal fit.")
  ).toBeVisible();
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
