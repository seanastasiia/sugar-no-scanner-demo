import { describe, expect, it } from "vitest";
import { auditShelfInventory, type ShelfAuditIdentity } from "./personal-shelf-audit";
import type { ShelfEvidence } from "../lib/personal-shelf-rank";

const item: ShelfAuditIdentity = { id: "barbora:a", source: "barbora_lv", title: "Potato chips", category: "chips", brand: "Test", packSize: "100g", gtin: "4006381333931" };
const evidence: ShelfEvidence = { productId: item.id, source: "barbora_lv", sourceUrl: "https://barbora.lv/produkti/a", checkedAt: "2026-09-03T10:00:00Z", gtin: item.gtin,
  category: "chips", nutritionBasis: "100g", ingredientsText: "Potatoes, sunflower oil, salt", ingredientsLanguage: "en", energyKcal: 500,
  proteinG: 5, totalSugarG: 1, fiberG: 3, saltG: 1, saturatedFatG: 2, carbohydrateG: 50, fatG: 30 };

describe("whole-catalog Personal Fit audit", () => {
  it("accounts for source inventory without counting nutrition subsets a second time", () => {
    const result = auditShelfInventory([item, item, { ...item, id: "barbora:unknown", category: null, gtin: null }], [evidence]);
    expect(result.summary.sourceRecords).toBe(3);
    expect(result.summary.distinctSourceIds).toBe(2);
    expect(result.summary.assessable).toBe(1);
    expect(result.summary.totals.unsupported).toBe(1);
    expect(result.duplicateSourceIds).toEqual([item.id]);
    expect(result.summary.globallyUniqueProducts).toBeNull();
  });
  it("keeps missing fields and contradictory observations unscored", () => {
    expect(auditShelfInventory([item], [{ ...evidence, saltG: null }]).records[0].status).toBe("missing_data");
    expect(auditShelfInventory([item], [{ ...evidence, proteinG: 80 }]).records[0].contradictoryNutrition).toBe(true);
    const result = auditShelfInventory([item], [{ ...evidence, fiberG: null }]);
    expect(result.records[0].status).toBe("provisional");
    expect(result.records[0].missing).toEqual(["fiber"]);
  });
  it("reports valid cross-source barcode candidates without merging or borrowing recipes", () => {
    const other = { ...item, id: "rimi_lv:b", source: "rimi_lv", gtin: "04006381333931", packSize: "200g" };
    const result = auditShelfInventory([item, other], [evidence]);
    expect(result.summary.distinctSourceIds).toBe(2);
    expect(result.summary.crossSourceGtinReviewGroups).toBe(1);
    expect(result.gtinReviewGroups[0].reviewFlags).toEqual(["pack sizes differ"]);
    expect(result.records[1].status).toBe("missing_data");
    expect(result.records[1].score).toBeNull();
  });
  it("never groups truncated/invalid barcodes or equal names", () => {
    const result = auditShelfInventory([item, { ...item, id: "livinn_lt:b", source: "livinn_lt", gtin: "4006381333932" }], []);
    expect(result.summary.crossSourceGtinReviewGroups).toBe(0);
    expect(result.rejectedGtins).toEqual(["livinn_lt:b"]);
  });
  it("quarantines ambiguous observations and accounts for evidence outside the inventory", () => {
    const result = auditShelfInventory([item], [evidence, { ...evidence, totalSugarG: 50 }, { ...evidence, productId: "barbora:outside" }]);
    expect(result.records[0].status).toBe("missing_data");
    expect(result.duplicateEvidenceIds).toEqual([item.id]);
    expect(result.evidenceOutsideInventory).toEqual(["barbora:outside"]);
  });
  it("does not expose scores for excluded products or accept a mismatched source", () => {
    expect(auditShelfInventory([{ ...item, excluded: true }], [evidence]).records[0].score).toBeNull();
    expect(auditShelfInventory([item], [{ ...evidence, source: "rimi_lv" }]).records[0].status).toBe("missing_data");
  });
  it("lists multilingual alias candidates without declaring or merging them", () => {
    const other = { ...item, id: "livinn_lt:b", source: "livinn_lt", title: "Bulvių traškučiai", aliases: ["Potato chips"], gtin: null };
    const result = auditShelfInventory([item, other], [evidence]);
    expect(result.multilingualReviewGroups).toEqual([{ identityKey: ["test", "1x100g", "potato chips"], ids: [item.id, other.id] }]);
    expect(result.summary.globallyUniqueProducts).toBeNull();
    expect(result.records[1].hasEvidence).toBe(false);
  });
});
