import { describe, expect, it } from "vitest";
import { parseCspPriceCsv } from "./csp-catalog";

const header = ["ITEM", "GTIN/EAN", "DATUMS", "PAMATCENA_GAB", "PAMATCENA_VIENIBA", "QUANTITY", "MERVIENIBA", "NOSAUKUMS", "CENA_AR_ATLAIDI", "RAZOTAJS", "URL", "HIERARHIJA_3LIMENIS_NOSAUKUMS"];
const csv = (rows: string[][]) => [header, ...rows].map((row) => row.join(";")).join("\n");

describe("CSP official daily price adapter", () => {
  it("keeps price evidence separate and emits an identity with no nutrition", () => {
    const result = parseCspPriceCsv(csv([
      ["Piens TEST 2% 1l", "3017620422003", "07.09.2026", "1,29", "1,29", "1", "l", "Rimi Latvia", "1,09", "TEST Foods", "https://www.rimi.lv/e-veikals/lv/produkti/test", "Piens"]
    ]));
    expect(result.records[0]).toMatchObject({ retailer: "Rimi", basePricePackage: 1.29, discountPrice: 1.09, unit: "l" });
    expect(result.identities[0]).toMatchObject({ source: "csp_lv", title: "Piens TEST 2% 1l", brand: "TEST Foods" });
    expect(result.identities[0]).not.toHaveProperty("ratingStatus");
    expect(result.identities[0]).not.toHaveProperty("nutritionBasis");
    expect(result.identities[0]).not.toHaveProperty("shelfEvidence");
  });

  it("merges source names only for the same GTIN, date, manufacturer and pack", () => {
    const result = parseCspPriceCsv(csv([
      ["Piens TEST 2% 1l", "3017620422003", "07.09.2026", "1,29", "1,29", "1", "l", "Rimi", "", "TEST Foods", "https://www.rimi.lv/example", "Piens"],
      ["TEST piens 2% 1 l", "3017620422003", "07.09.2026", "1,35", "1,35", "1", "l", "Maxima", "", "TEST Foods", "https://www.maxima.lv/example", "Piena produkti"]
    ]));
    expect(result.records).toHaveLength(2);
    expect(result.identities).toHaveLength(1);
    expect([result.identities[0]!.title, ...result.identities[0]!.aliases]).toEqual(expect.arrayContaining(["Piens TEST 2% 1l", "TEST piens 2% 1 l"]));
  });

  it("rejects unknown schemas, invalid rows and conflicting identities", () => {
    expect(() => parseCspPriceCsv("name,barcode\nMilk,123")).toThrow(/Unknown CSP CSV schema/);
    const result = parseCspPriceCsv(csv([
      ["Milk", "3017620422004", "07.09.2026", "1", "1", "1", "l", "Rimi", "", "TEST Foods", "", "Piens"],
      ["Milk", "3017620422003", "07.09.2026", "1", "1", "1", "l", "Rimi", "", "TEST Foods", "", "Piens"],
      ["Milk", "3017620422003", "07.09.2026", "1", "1", "2", "l", "Maxima", "", "TEST Foods", "", "Piens"]
    ]));
    expect(result.rejected.invalid_gtin).toBe(1);
    expect(result.identityConflicts).toEqual(["03017620422003"]);
    expect(result.identities).toEqual([]);
  });
});
