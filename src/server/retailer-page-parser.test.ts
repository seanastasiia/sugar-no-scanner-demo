import { describe, expect, it } from "vitest";
import { parseLivinProductPage, parseRimiProductPage } from "./retailer-page-parser";

function productJsonLd(value: object): string {
  return `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Product", ...value })}</script>`;
}

describe("retailer product page parsers", () => {
  it("extracts source-backed nutrition and price from a Rimi page", () => {
    const details = JSON.stringify(`
      <span>Zīmols</span><div><p>GEISHA</p></div>
      <span>Ražotājs</span><div><p>Fazer</p></div>
      <p>Uzturvērtība 100 g</p><table>
      <tr><td>enerģētiskā vērtība</td><td>2302 kJ / 550 kcal</td></tr>
      <tr><td>ogļhidrāti</td><td>54 g</td></tr>
      <tr><td>tostarp cukuri</td><td>49 g</td></tr>
      <tr><td>olbaltumvielas</td><td>8 g</td></tr></table>
    `);
    const html = `${productJsonLd({
      name: "Konfektes Geisha piena šokolādes 150g",
      sku: "100761",
      image: ["https://cdn.example/geisha.png"],
      offers: { price: "5.69", priceCurrency: "EUR", availability: "InStock" }
    })}<script>Storefront.product_details_page={tabs:[{identifier:'details',html:${details}}]}</script>`;
    expect(
      parseRimiProductPage(
        html,
        "https://www.rimi.lv/e-veikals/lv/produkti/saldumi/konfektes/p/100761",
        "2026-08-26T00:00:00.000Z"
      )
    ).toMatchObject({
      source: "rimi_lv",
      retailer: "Rimi",
      brand: "GEISHA",
      packSize: "150g",
      energyKcal: 550,
      carbohydrateG: 54,
      proteinG: 8,
      totalSugarG: 49,
      price: 5.69,
      available: true
    });
  });

  it("extracts GTIN, nutrition and availability from a Livin page", () => {
    const html = `${productJsonLd({
      name: "Smiltsērkšķu un ābolu strēmeles",
      sku: "SS462",
      gtin12: "477904241037",
      brand: { "@type": "Brand", name: "LABU" },
      image: { url: "https://cdn.example/labu.jpg" },
      offers: { price: "2.19", priceCurrency: "EUR", availability: "https://schema.org/OutOfStock" }
    })}<div class="product__fixed-content"><span class="text--gray">60 g</span></div>
      <h3>Uzturvērtība</h3><table><tr><td>Uzturvērtība (100 g)</td></tr>
      <tr><td>Enerģētiskā vērtība</td><td>1297 kJ / 307 kcal</td></tr>
      <tr><td>Ogļhidrāti</td><td>72 g</td></tr>
      <tr><td>t. sk. cukuri</td><td>59 g</td></tr>
      <tr><td>Olbaltumvielas</td><td>1,9 g</td></tr></table>`;
    expect(parseLivinProductPage(html, "https://www.livin.lv/p/example", "2026-08-26T00:00:00.000Z")).toMatchObject({
      source: "livin_lv",
      retailer: "Livin",
      brand: "LABU",
      gtin: "477904241037",
      packSize: "60 g",
      energyKcal: 307,
      carbohydrateG: 72,
      proteinG: 1.9,
      totalSugarG: 59,
      price: 2.19,
      available: false
    });
  });

  it("fails closed when the required protein or sugar value is absent", () => {
    const html = productJsonLd({ name: "Unknown", sku: "1", offers: { price: "1.00", priceCurrency: "EUR" } });
    expect(parseRimiProductPage(html, "https://www.rimi.lv/e-veikals/lv/produkti/a/p/1")).toBeNull();
    expect(parseLivinProductPage(html, "https://www.livin.lv/p/a")).toBeNull();
  });

  it("does not treat an all-zero retailer placeholder as a GTIN", () => {
    const html = `${productJsonLd({
      name: "Example",
      sku: "ABC-1",
      gtin12: "000000000000",
      brand: "Example",
      offers: { price: "1.00", priceCurrency: "EUR", availability: "InStock" }
    })}<h3>Uzturvērtība</h3><table><tr><td>Uzturvērtība (100 g)</td></tr>
      <tr><td>Enerģētiskā vērtība</td><td>420 kJ / 100 kcal</td></tr>
      <tr><td>t. sk. cukuri</td><td>2 g</td></tr>
      <tr><td>Olbaltumvielas</td><td>4 g</td></tr></table>`;
    expect(parseLivinProductPage(html, "https://www.livin.lv/p/example")?.gtin).toBeNull();
  });
});
