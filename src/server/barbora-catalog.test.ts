import { describe, expect, it } from "vitest";
import {
  isExactBarboraMatch,
  parseBarboraProductPage,
  rankBarboraCandidates,
  rankIndexedBarboraCandidates,
  retailerBrandMatches
} from "./barbora-catalog";

describe("Barbora product lookup", () => {
  it("ranks the photographed Sanpellegrino flavor ahead of other variants", () => {
    const candidates = rankBarboraCandidates(
      {
        brand: "Sanpellegrino",
        name: "Zero Italian sparkling drink",
        variant: "Pesca & Clementina",
        packSize: "330 ml",
        searchTerms: ["zero peach", "clementine"]
      },
      [
        "gaz-dz-sanpellegrino-zero-limon-0-33-l-d",
        "gaz-dz-sanpellegrino-zero-peach-0-33-l-d",
        "gaz-dz-sanpellegrino-pompelmo-0-33-l-d"
      ]
    );

    expect(candidates[0]?.slug).toBe("gaz-dz-sanpellegrino-zero-peach-0-33-l-d");
  });

  it("parses the public product payload without relying on rendered markup", () => {
    const product = parseBarboraProductPage(`
      <script>window.product = {"title":"Example drink 330ml","brand_name":"EXAMPLE","price":0.99,"Url":"example-drink-330-ml","status":"active"};</script>
    `);
    expect(product).toMatchObject({ title: "Example drink 330ml", brand_name: "EXAMPLE", price: 0.99 });
  });

  it("requires both a confidence threshold and a clear candidate margin for exact-SKU status", () => {
    expect(isExactBarboraMatch(0.78, 0.65)).toBe(true);
    expect(isExactBarboraMatch(0.75, 0.71)).toBe(false);
    expect(isExactBarboraMatch(0.9, 0.87)).toBe(false);
  });

  it("rejects a Pepsi retailer page for a photographed Coca-Cola package", () => {
    expect(retailerBrandMatches("Coca-Cola", "PEPSI")).toBe(false);
    expect(retailerBrandMatches("Coca-Cola", "COCA COLA")).toBe(true);
    expect(retailerBrandMatches("Sanpellegrino", "SAN PELLEGRINO")).toBe(true);
  });

  it("uses distinctive variant and pack-size evidence across the broad nutrition index", () => {
    const candidates = rankIndexedBarboraCandidates(
      {
        brand: "Spilva",
        name: "Siera mayonnaise 250g",
        variant: "cheese",
        packSize: "250g",
        searchTerms: ["Spilva siera majonēze"]
      },
      [
        {
          slug: "majoneze-siera-spilva-250-g",
          title: "Majonēze SPILVA ar siera garšu 250g",
          brand: "SPILVA",
          category: "Majonēze",
          packSize: "250g",
          nutritionBasis: "100g",
          energyKcal: 600,
          proteinG: 1.2,
          totalSugarG: 3,
          imageUrl: null,
          isAdult: false,
          checkedAt: "2026-08-25"
        },
        {
          slug: "majoneze-rosola-spilva-250-g",
          title: "Majonēze SPILVA rosolam 250g",
          brand: "SPILVA",
          category: "Majonēze",
          packSize: "250g",
          nutritionBasis: "100g",
          energyKcal: 600,
          proteinG: 1,
          totalSugarG: 4,
          imageUrl: null,
          isAdult: false,
          checkedAt: "2026-08-25"
        }
      ]
    );

    expect(candidates[0]?.slug).toBe("majoneze-siera-spilva-250-g");
    expect(isExactBarboraMatch(candidates[0]?.score || 0, candidates[1]?.score || 0)).toBe(true);
  });

  it("rejects a different pack size before exact retailer linking", () => {
    const candidates = rankIndexedBarboraCandidates(
      {
        brand: "Example",
        name: "Greek yogurt 400g",
        variant: "",
        packSize: "400g",
        searchTerms: ["Example Greek yogurt"]
      },
      [
        {
          slug: "example-greek-yogurt-150-g",
          title: "Example Greek yogurt 150g",
          brand: "Example",
          category: "Yogurt",
          packSize: "150g",
          nutritionBasis: "100g",
          energyKcal: 100,
          proteinG: 8,
          totalSugarG: 4,
          imageUrl: null,
          isAdult: false,
          checkedAt: "2026-08-25"
        }
      ]
    );

    expect(candidates).toEqual([]);
  });
});
