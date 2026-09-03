import { afterEach, describe, expect, it, vi } from "vitest";
import { approvedWebProductUrl, fetchVerifiedWebProduct, validWebGtin, verifyWebProductPage, webLookupKey, webPack } from "./web-product-evidence";
import { lookup, page, productUrl } from "./__fixtures__/verified-web-product";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("exact web page evidence", () => {
  it("reads values from the product's own table, with source date and no invented fibre", () => {
    const result = verifyWebProductPage(lookup, page(), productUrl, "2026-09-03T00:00:00.000Z");
    expect(result?.product).toMatchObject({ id: expect.stringMatching(/^web:shared:/), brand: "SELGA", energyKcalPer100: 440,
      nutrientsPer100g: { proteinG: 7.2, totalSugarG: 24, carbohydrateG: 61, fiberG: null }, gtin: "04006381333931", imageUrl: null });
    expect(result?.product.sources[0].fields).not.toContain("fiber");
  });
  it.each(["g", "г"])("keeps a source-listed zero distinct from missing (%s)", (unit) => {
    const result = verifyWebProductPage(lookup, page({}, `<tr><td>Sugars</td><td>0 ${unit}</td></tr>`), productUrl);
    expect(result?.product.nutrientsPer100g).toEqual({ proteinG: null, totalSugarG: 0, carbohydrateG: null, fiberG: null });
  });
  it.each(["<0.5 g", "trace", "", "5", "5 mg", "5 g / 10 g"])("does not turn an ambiguous value into a number: %s", (value) => {
    expect(verifyWebProductPage(lookup, page({}, `<tr><td>Sugars</td><td>${value}</td></tr>`), productUrl)?.product.nutrientsPer100g.totalSugarG).toBeNull();
  });
  it("does not convert a serving table or infer a per-100 basis", () => {
    expect(verifyWebProductPage(lookup, page().replace("100 g", "30 g"), productUrl)?.product.nutrientsPer100g.proteinG).toBeNull();
  });
  it("does not borrow a number from the next row", () => {
    const result = verifyWebProductPage(lookup, page({}, "<tr><td>Protein</td><td>not listed</td></tr><tr><td>Sugars</td><td>5 g</td></tr>"), productUrl);
    expect(result?.product.nutrientsPer100g.proteinG).toBeNull();
    expect(result?.product.nutrientsPer100g.totalSugarG).toBe(5);
  });
  it("quarantines internally contradictory tables", () => {
    expect(verifyWebProductPage(lookup, page().replace("61 g", "20 g"), productUrl)?.product.nutrientsPer100g.totalSugarG).toBeNull();
    expect(verifyWebProductPage(lookup, page().replace("7.2 g", "80 g"), productUrl)?.product.nutrientsPer100g.proteinG).toBeNull();
  });
  it("supports explicit structured per-100 nutrition but not an unattached recipe", () => {
    const html = page({ nutrition: { servingSize: "100 g", proteinContent: "7.2 g", sugarContent: "24 g", calories: "440 kcal" } }, "");
    expect(verifyWebProductPage(lookup, html, productUrl)?.product.nutrientsPer100g.proteinG).toBe(7.2);
    expect(verifyWebProductPage(lookup, page({}, "") + '<script type="application/ld+json">{"@type":"Recipe","nutrition":{"servingSize":"100 g","proteinContent":"90 g"}}</script>', productUrl)?.product.nutrientsPer100g.proteinG).toBeNull();
  });
  it("reads the real Livinn paragraph format with zero protein, fibre and less-than fat", () => {
    const html = page({}, "") + '<p>Maistinė vertė (100 g) &ndash; 1382 kJ / 325 kcal: riebalų &lt;0.5 g (i&scaron; jų sočiųjų riebalų rūg&scaron;čių 0.2 g), angliavandenių 79 g (i&scaron; jų cukrų 62 g), skaidulinių medžiagų 2.2 g, baltymų 0 g, druskos 0.21 g.</p>';
    expect(verifyWebProductPage(lookup, html, productUrl)?.product).toMatchObject({ energyKcalPer100: 325, nutrientsPer100g: { proteinG: 0, totalSugarG: 62, carbohydrateG: 79, fiberG: 2.2 } });
    expect(verifyWebProductPage(lookup, html.replace("baltymų 0 g", "baltymų &lt;0.5 g"), productUrl)?.product.nutrientsPer100g.proteinG).toBeNull();
  });
  it("rejects adjacent Product cards, wrong brand, variant, size and concentration", () => {
    expect(verifyWebProductPage(lookup, page() + page(), productUrl)).toBeNull();
    expect(verifyWebProductPage({ ...lookup, brand: "OTHER" }, page(), productUrl)).toBeNull();
    expect(verifyWebProductPage({ ...lookup, variant: "Chocolate" }, page(), productUrl)).toBeNull();
    expect(verifyWebProductPage({ ...lookup, packSize: "200 g" }, page(), productUrl)).toBeNull();
    expect(verifyWebProductPage({ ...lookup, name: "Milk 3.2% 180 g", variant: "" }, page({ name: "Milk 2% 180 g" }), productUrl)).toBeNull();
    expect(verifyWebProductPage({ ...lookup, packSize: "2x180 g" }, page(), productUrl)).toBeNull();
  });
  it("links translations only with the source-confirmed barcode, brand and pack", () => {
    const translated = { ...lookup, name: "Классическое печенье 180 г", variant: "", barcode: "4006381333931" };
    expect(verifyWebProductPage(translated, page(), productUrl)?.product.id).toBe(verifyWebProductPage(lookup, page(), productUrl)?.product.id);
    expect(verifyWebProductPage({ ...translated, barcode: "" }, page(), productUrl)).toBeNull();
    expect(verifyWebProductPage({ ...translated, barcode: "5901234123457" }, page(), productUrl)).toBeNull();
    expect(verifyWebProductPage(translated, page({ gtin13: "0000000000000" }), productUrl)).toBeNull();
  });
  it("normalizes pack units without conflating multipacks or grams with millilitres", () => {
    expect(webPack("0,18 kg")?.key).toBe(webPack("180 г")?.key);
    expect(webPack("2 × 180 g")?.key).not.toBe(webPack("360 g")?.key);
    expect(webPack("180 ml")?.key).not.toBe(webPack("180 g")?.key);
    expect(webPack("180 g and 200 g")).toBeNull();
  });
  it("validates GTIN checksum and preserves query field boundaries", () => {
    expect(validWebGtin("4006381333931")).toBe("04006381333931");
    expect(validWebGtin("4006381333932")).toBeNull();
    expect(webLookupKey({ ...lookup, name: "A B", variant: "C" })).not.toBe(webLookupKey({ ...lookup, name: "A", variant: "B C" }));
  });
  it.each(["http://www.livin.lv/p/a", "https://www.livin.lv.evil.com/p/a", "https://127.0.0.1/p/a", "https://world.openfoodfacts.org/product/1", "https://www.livin.lv:444/p/a", "https://user:pass@www.livin.lv/p/a"])("rejects unreviewed/unsafe source URLs: %s", (url) => {
    expect(approvedWebProductUrl(url)).toBeNull();
  });
  it("does not fetch a redirect outside reviewed hosts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchVerifiedWebProduct(lookup, productUrl)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("fetches a bounded actual product page without following arbitrary redirects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(page(), { headers: { "content-type": "text/html" } })));
    expect((await fetchVerifiedWebProduct(lookup, productUrl))?.product.nutrientsPer100g.proteinG).toBe(7.2);
  });
});
