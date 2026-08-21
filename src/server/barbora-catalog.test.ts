import { describe, expect, it } from "vitest";
import {
  isExactBarboraMatch,
  parseBarboraProductPage,
  rankBarboraCandidates,
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
});
