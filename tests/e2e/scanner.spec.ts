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
  await expect(page.getByText("Private demo", { exact: true })).toHaveCount(0);
});

test("sample shelf photo highlights products and shows a three-signal Sugar.no badge", async ({ page }) => {
  await unlock(page);
  await page.getByRole("button", { name: /Shelf photo/ }).click();
  await expect(page.getByRole("status")).toContainText("4 unique products recognized");
  await expect(page.getByLabel("Shelf photo scanner").locator('button[aria-label^="Open Sugar.no-rated"]')).toHaveCount(4);
  await expect(page.getByText("4 Sugar.no picks", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Sample shelf photo with four supported protein snacks").locator("img")).toHaveCount(1);
  await expect(page.getByAltText("Four protein bars on a supermarket shelf")).toBeVisible();
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLImageElement>('div[aria-label="Sample shelf photo with four supported protein snacks"] img')]
      .every((image) => image.complete && image.naturalWidth > 0)
  );
  await waitForAlternativeImages(page);
  await page.screenshot({ path: "docs/screenshots/shelf-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Open product results", exact: true }).click();
  const resultsDialog = page.getByRole("dialog", { name: "Products from this scan" });
  await expect(resultsDialog).toBeVisible();
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  await expect.poll(async () => (await resultsDialog.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(viewportHeight * 0.95);
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
  await page.getByRole("button", { name: /Checkout photo/ }).click();
  await expect(page.getByRole("status")).toContainText("4 unique products recognized on checkout");
  await expect(page.getByLabel("Checkout photo scanner").locator('button[aria-label^="Open Sugar.no-rated"]')).toHaveCount(4);
  await expect(page.getByAltText("Four protein bars on a supermarket checkout belt")).toBeVisible();
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLImageElement>('div[aria-label="Sample checkout photo with four supported protein snacks"] img')]
      .every((image) => image.complete && image.naturalWidth > 0)
  );
  await waitForAlternativeImages(page);
  await page.screenshot({ path: "docs/screenshots/checkout-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Open product results", exact: true }).click();
  const tray = page.getByLabel("Products in this scan");
  await expect(tray).toBeVisible({ timeout: 8_000 });
  await expect(tray.getByRole("button")).toHaveCount(4);
  await expect(page.getByText("Compare without starting over")).toBeVisible();
  await expect(page.getByRole("button", { name: /save/i })).toHaveCount(0);
  await waitForAlternativeImages(page);
});

test("sample scenes switch in place without exposing save actions", async ({ page }) => {
  await unlock(page);
  await page.getByRole("button", { name: /Shelf photo/ }).click();
  await expect(page.getByRole("status")).toContainText("4 unique products recognized");

  const sceneSwitch = page.getByLabel("Sample scene");
  await sceneSwitch.getByRole("button", { name: "Checkout", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("4 unique products recognized on checkout");
  await expect(sceneSwitch.getByRole("button", { name: "Checkout", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Open product results", exact: true }).click();
  await expect(page.getByText("Compare without starting over")).toBeVisible();
  await expect(page.getByRole("button", { name: /save/i })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Saved options" })).toHaveCount(0);
  await page.getByRole("button", { name: "Return to camera" }).click();
  await page.getByRole("button", { name: "Close scanner" }).click();
  await expect(page.getByRole("heading", { name: "Saved options" })).toHaveCount(0);
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
  await page.getByRole("button", { name: /Shelf photo/ }).click();
  await page.getByRole("button", { name: "Open product results", exact: true }).click();
  await expect(page.getByLabel("Sugar.no badge")).toBeVisible();
  await expect(page.getByRole("button", { name: /save/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("scanner remains operable at narrow portrait and phone landscape sizes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await unlock(page);
  await page.getByRole("button", { name: /Shelf photo/ }).click();
  const portraitStage = page.getByLabel("Shelf photo scanner").locator(":scope > div").first();
  const portraitStageBox = await portraitStage.boundingBox();
  expect(portraitStageBox?.height).toBeGreaterThanOrEqual(812 * 0.95);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Open product results", exact: true }).click();
  await expect(page.getByLabel("Sugar.no badge")).toBeVisible();

  await page.setViewportSize({ width: 812, height: 375 });
  await expect(page.getByLabel("Sugar.no badge")).toBeVisible();
  await page.getByRole("button", { name: "Collapse product results" }).click();
  await expect(page.getByRole("button", { name: "Close scanner" })).toBeVisible();
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
  await expect(page.getByRole("dialog", { name: "Products from this scan" })).toHaveCount(0);
  await expect(page.getByLabel("Saved shelf or checkout photo scanner")).toBeVisible();
});

test("live camera groups repeated packs, holds the result and replaces it only after Scan again", async ({ page }) => {
  await page.addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 960;
    const context = canvas.getContext("2d");
    context?.fillRect(0, 0, canvas.width, canvas.height);
    let tick = 0;
    window.setInterval(() => {
      if (!context) return;
      context.fillStyle = tick++ % 2 ? "#000" : "#111";
      context.fillRect(0, 0, 2, 2);
    }, 120);
    Object.defineProperty(window, "__scannerTestCanvas", { value: canvas });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => canvas.captureStream(5) }
    });
  });
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

  await page.getByRole("button", { name: "Start live camera" }).click();
  await expect(page.getByRole("status")).toContainText("1 unique product recognized", { timeout: 10_000 });
  await expect(page.getByText("1 product identified", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Live camera scanner").locator('button[aria-label^="Open Sugar.no-rated"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Open product results", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Coca-Cola Original Taste/ })).toBeVisible();
  await expect(page.getByText("No Sugar.no rating in this scan.")).toBeVisible();
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
  await expect(page.getByRole("status")).toContainText("1 unique product recognized", { timeout: 10_000 });
  await page.getByRole("button", { name: "Open product results", exact: true }).click();
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
  await page.locator('input[type="file"]').setInputFiles({
    name: "price-check.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    )
  });
  await expect(page.getByRole("status")).toContainText("1 unique product recognized");
  await expect(
    page.getByLabel("Product result preview").getByLabel("Shelf price €1.69, Barbora €0.99, cheaper at Barbora")
  ).toBeVisible();
  await page.getByRole("button", { name: "Open product results", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Zero Peach.*Pesca & Clementina.*330 ml/ })).toBeVisible();
  await expect(page.getByLabel("Saved shelf or checkout photo scanner").locator('button[aria-label^="Open Sugar.no-rated"]')).toHaveCount(0);
  await expect(page.getByLabel("Shelf marker legend")).toHaveCount(0);
  await expect(page.getByText("No Sugar.no rating in this scan.")).toBeVisible();
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
  await page.getByRole("button", { name: "Close scanner" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "possible-price-check.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    )
  });
  await page.getByRole("button", { name: "Open product results", exact: true }).click();
  await expect(comparison.getByText("Shelf price", { exact: true })).toBeVisible();
  await expect(comparison.getByText("Possible Barbora match")).toHaveCount(0);
  await expect(comparison.getByText("€1.69", { exact: true })).toHaveCSS("text-decoration-line", "none");
  await expect(comparison.getByText("Cheaper at Barbora", { exact: true })).toHaveCount(0);
  await expect(comparison.getByRole("link")).toHaveCount(0);

  exactSku = true;
  includeShelfPrice = false;
  await page.getByRole("button", { name: "Return to camera" }).click();
  await page.getByRole("button", { name: "Close scanner" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "package-without-shelf-label.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    )
  });
  await page.getByRole("button", { name: "Open product results", exact: true }).click();
  await expect(page.getByLabel("Price comparison")).toHaveCount(0);
  await expect(page.getByLabel(/Shelf price €/)).toHaveCount(0);
  await expect(page.getByText(/Keep the package and its shelf label/)).toHaveCount(0);
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
          ratingSignalCount: 2,
          criterionScores: { protein: 55, fiber: null, inverseSugar: 20 }
        },
        alternatives: []
      })
    });
  });

  await page.waitForLoadState("networkidle");
  await page.locator('input[type="file"]').setInputFiles({
    name: "exact-barbora-food.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    )
  });

  await expect(page.getByRole("status")).toContainText("1 unique product recognized");
  await expect(page.getByText("Checking nutrition…", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Saved shelf or checkout photo scanner").locator('button[aria-label^="Open Sugar.no-rated"]')).toHaveCount(1);
  await expect(page.getByText("1 Sugar.no pick", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open product results", exact: true }).click();
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
