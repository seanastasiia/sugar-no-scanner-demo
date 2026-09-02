import { describe, expect, it } from "vitest";
import type { ProductDetection } from "./types";
import { dedupeProductDetections, productDetectionKey } from "./product-detection-dedupe";

function coke(name: string, x: number, confidence = 0.9): ProductDetection {
  return {
    productId: `visual:${name.toLowerCase().replaceAll(" ", "-")}`,
    confidence,
    box: { x, y: 0.2, width: 0.16, height: 0.5 },
    observedText: name,
    identity: {
      brand: "Coca-Cola",
      name,
      variant: null,
      packSize: "330 ml",
      category: null,
      matchKind: "visual_only"
    }
  };
}

describe("dedupeProductDetections", () => {
  it("collapses repeated packages of the same product type and unions their boxes", () => {
    const result = dedupeProductDetections([
      coke("Coca-Cola Original Taste", 0.1, 0.88),
      coke("Coca Cola Original", 0.3, 0.96),
      coke("Coca-Cola Original Taste can", 0.5, 0.91),
      coke("Coca-Cola", 0.7, 0.86)
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(0.96);
    expect(result[0].box.x).toBeCloseTo(0.1);
    expect(result[0].box.y).toBeCloseTo(0.2);
    expect(result[0].box.width).toBeCloseTo(0.76);
    expect(result[0].box.height).toBeCloseTo(0.5);
  });

  it("keeps a zero-sugar variant separate from original", () => {
    const original = coke("Coca-Cola Original Taste", 0.1);
    const zero = coke("Coca-Cola Zero Sugar", 0.5);
    expect(productDetectionKey(original)).not.toBe(productDetectionKey(zero));
    expect(dedupeProductDetections([original, zero])).toHaveLength(2);
  });

  it("uses an exact retailer slug as the strongest SKU identity", () => {
    const first = coke("Coca-Cola Original Taste", 0.1);
    const second = coke("Coca-Cola classic", 0.5);
    for (const detection of [first, second]) {
      detection.retailerOffer = {
        retailer: "Barbora",
        slug: "gazets-dzeriens-coca-cola-0-33-l",
        title: "Coca-Cola 0,33 L",
        brand: "COCA-COLA",
        url: "https://barbora.lv/produkti/gazets-dzeriens-coca-cola-0-33-l",
        price: 0.89,
        currency: "EUR",
        unitPrice: null,
        unit: null,
        imageUrl: null,
        checkedAt: "2026-08-20T00:00:00.000Z",
        matchConfidence: 0.9,
        exactSku: true
      };
    }
    expect(dedupeProductDetections([first, second])).toHaveLength(1);
  });

  it("collapses overlapping detections of the same package read in different languages", () => {
    const russian = coke("Сухарики с оливковым маслом 100 г", 0.1, 0.9);
    russian.identity!.brand = "Valledoro";
    russian.identity!.packSize = "100 g";
    russian.box = { x: 0.1, y: 0.2, width: 0.25, height: 0.5 };
    const italian = coke("Crostini Classici all'olio d'oliva", 0.12, 0.94);
    italian.identity!.brand = "VALLEDORO";
    italian.identity!.packSize = null;
    italian.box = { x: 0.12, y: 0.23, width: 0.2, height: 0.42 };
    italian.productId = "web:valledoro-crostini";
    italian.identity!.matchKind = "web_search";

    const result = dedupeProductDetections([russian, italian]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ productId: "web:valledoro-crostini" });
  });

  it("collapses separate language readings after both resolve to the same exact SKU", () => {
    const italian = coke("Crostini Classici all'olio d'oliva", 0.05);
    italian.productId = "livinn_lt:1AM092401277";
    italian.identity!.brand = "Valledoro";
    italian.identity!.matchKind = "retailer_catalog";
    italian.identity!.packSize = "100 g";
    const russian = coke("Кростини с оливковым маслом", 0.7);
    russian.productId = "livinn_lt:1AM092401277";
    russian.identity!.brand = "Valledoro";
    russian.identity!.matchKind = "retailer_catalog";
    russian.identity!.packSize = "100 г";

    expect(dedupeProductDetections([italian, russian])).toHaveLength(1);
  });

  it("keeps separate packages apart when only brand and pack match", () => {
    const olive = coke("Crostini olive oil", 0.05);
    olive.identity!.brand = "Valledoro";
    olive.identity!.packSize = "100 g";
    const rosemary = coke("Tarallini rosemary", 0.7);
    rosemary.identity!.brand = "Valledoro";
    rosemary.identity!.packSize = "100 g";
    expect(dedupeProductDetections([olive, rosemary])).toHaveLength(2);
  });
});
