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

  it("handles Latvian word endings when ranking an exact Selga flavor", () => {
    const candidates = rankIndexedBarboraCandidates(
      {
        brand: "Selga",
        name: "Selga Classic Cepumi ar iebiezināta piena garšu",
        variant: "",
        packSize: "",
        searchTerms: ["Selga cepumi ar iebiezināta piena garšu"]
      },
      [
        {
          slug: "cepumi-selga-ar-iebiez-pienu-180-g",
          title: "Cepumi SELGA ar iebiezināto pienu 180g",
          brand: "SELGA",
          category: "Cepumi",
          packSize: "180g",
          nutritionBasis: "100g",
          energyKcal: 426,
          proteinG: 8.3,
          totalSugarG: 22,
          imageUrl: null,
          isAdult: false,
          checkedAt: "2026-08-25"
        },
        {
          slug: "cepumi-selga-ar-karamelu-garsu-180-g",
          title: "Cepumi SELGA ar karameļu garšu 180g",
          brand: "SELGA",
          category: "Cepumi",
          packSize: "180g",
          nutritionBasis: "100g",
          energyKcal: 426,
          proteinG: 8.4,
          totalSugarG: 23,
          imageUrl: null,
          isAdult: false,
          checkedAt: "2026-08-25"
        }
      ]
    );
    expect(candidates[0]?.slug).toBe("cepumi-selga-ar-iebiez-pienu-180-g");
  });

  it("uses the supported dairy-dessert pack when the front sub-brand differs from the manufacturer brand", () => {
    const candidates = rankIndexedBarboraCandidates(
      {
        brand: "ProteinFit",
        name: "Protein Fit peach curd cream 300g",
        variant: "peach",
        packSize: "300g",
        searchTerms: ["ProteinFit persiku biezpiena krēms"],
        categoryHint: "dairy_desserts"
      },
      [
        {
          slug: "biezp-krems-protein-baltais-persiku-300-g",
          title: "Biezpiena krēms Protein BALTAIS persiku 300g",
          brand: "BALTAIS",
          category: "Piena produkti un olas/Biezpiena produkti/Saldais biezpiens",
          packSize: "300g",
          nutritionBasis: "100g",
          energyKcal: 80,
          proteinG: 10,
          totalSugarG: 4,
          imageUrl: null,
          isAdult: false,
          checkedAt: "2026-08-25"
        },
        {
          slug: "proteinfit-baltais-chocolate-300-g",
          title: "Biezpiena krēms ProteinFit BALTAIS šokolādes 300g",
          brand: "BALTAIS",
          category: "Piena produkti un olas/Biezpiena produkti/Saldais biezpiens",
          packSize: "300g",
          nutritionBasis: "100g",
          energyKcal: 90,
          proteinG: 10,
          totalSugarG: 5,
          imageUrl: null,
          isAdult: false,
          checkedAt: "2026-08-25"
        }
      ]
    );

    expect(candidates[0]?.slug).toBe("biezp-krems-protein-baltais-persiku-300-g");
  });

  it("keeps a clearly read classic snack ahead of same-brand flavored variants", () => {
    const base = {
      brand: "SELGA",
      category: "Bakaleja/Saldumi/Cepumi iepakojumos",
      packSize: "180g",
      nutritionBasis: "100g" as const,
      energyKcal: 420,
      proteinG: 7,
      totalSugarG: 20,
      imageUrl: null,
      isAdult: false,
      checkedAt: "2026-08-25"
    };
    const candidates = rankIndexedBarboraCandidates(
      {
        brand: "SELGA",
        name: "Selga Classic biscuits 180g",
        variant: "classic",
        packSize: "180g",
        searchTerms: ["Selga cepumi classic"],
        categoryHint: "snacks"
      },
      [
        { ...base, slug: "cepumi-selga-180-g", title: "Cepumi SELGA 180g" },
        {
          ...base,
          slug: "cepumi-selga-ar-sokolades-garsu-180-g",
          title: "Cepumi SELGA ar šokolādes garšu 180g"
        }
      ]
    );

    expect(candidates[0]?.slug).toBe("cepumi-selga-180-g");
    expect(isExactBarboraMatch(candidates[0]?.score || 0, candidates[1]?.score || 0)).toBe(true);
  });

  it("treats a 3+1 promotional pack as four units for an observed 4x80g shelf pack", () => {
    const candidates = rankIndexedBarboraCandidates(
      {
        brand: "Rio Mare",
        name: "Tonno all'Olio di Oliva 4x80g",
        variant: "olive oil",
        packSize: "4x80g",
        searchTerms: ["Rio Mare tuna olive oil"]
      },
      [
        {
          slug: "tunzivs-olivella-3-1-rio-mare-320-g",
          title: "Tunzivs olīveļļā 3+1 RIO MARE 320g",
          brand: "RIO MARE",
          category: "Tuncis",
          packSize: "320g",
          nutritionBasis: "100g",
          energyKcal: 403,
          proteinG: 17.5,
          totalSugarG: 0,
          imageUrl: null,
          isAdult: false,
          checkedAt: "2026-08-25"
        }
      ]
    );
    expect(candidates[0]?.slug).toBe("tunzivs-olivella-3-1-rio-mare-320-g");
  });
});
