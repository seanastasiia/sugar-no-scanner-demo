import { describe, expect, it } from "vitest";
import { reviewedIngredientBase } from "./personal-shelf-ingredient-aliases";
import { analyzeIngredients, assessPersonalShelfProduct, normalizeIngredientText, type ShelfCategory } from "./personal-shelf-rank";
import { shelfFixture } from "../../tests/fixtures/personal-shelf";

const base = (text: string, category: ShelfCategory = "bar", language = "lv") =>
  reviewedIngredientBase(normalizeIngredientText(text), language, category);

describe("v1.4 reviewed unknown-first-ingredient vocabulary", () => {
  it.each([
    ["Āboli", "lv"], ["Apples", "en"], ["Яблоки", "ru"], ["Obuoliai", "lt"],
    ["AUZAS (41%)", "lv"], ["avižos be glitimo", "lt"], ["Oats", "en"], ["Kaer", "et"],
    ["MANDELES", "lv"], ["džiovintos datulės*", "lt"], ["dateļu pasta", "lv"],
    ["Sudėtis: Avižos be glitimo", "lt"], ["Ciedru riekstu kodoli", "lv"],
    ["Kakavos masė*", "lt"], ["Čia (Salvia hispanica) sēklas", "lv"]
  ])("recognizes an explicit base without translating product names: %s", (text, language) => {
    expect(base(text, "bar", language)?.score).toBe(100);
  });
  it.each([
    ["pasterizēts govs PIENS", "lv"], ["Pasterizēts _piens_", "lv"], ["95,9% siers (PIENS, sāls)", "lv"],
    ["skimmed pasteurized milk", "en"], ["pasterizēts kazas PIENS", "lv"], ["PILNPIENS", "lv"],
    ["šviežia GRIETINĖLĖ", "lt"], ["Grieķu JOGURTS", "lv"]
  ])("recognizes a dairy label, not a translated guess: %s", (text, language) => {
    expect(base(text, "cheese", language)?.score).toBe(85);
  });
  it.each(["kietųjų kviečių manų kruopos", "cieto KVIEŠU manna", "nūdeles (KVIEŠU milti)", "Grauzdētas KVIEŠU pārslas", "Marcipāna masa (cukurs, mandeles)"])("keeps refined/composite bases distinct from whole plants: %s", text => {
    expect(base(text)?.score).toBe(25);
  });
  it.each([
    "Ūdens (mandeles 2%)", "vanduo", "rapšu eļļa", "kakavos aliejus", "almond oil", "cūku speķis", "palmu tauki",
    "ābolu sula", "apple juice", "apple concentrate", "datulių sirupas", "cukruotas imbieras", "mandeles ekstrakts",
    "mandeles pulveris", "oats protein", "oats starch", "apple flavour", "milk substitute", "Unknown mix", "graudaugi", "apple pectin", "apple filling",
    "Āboli (cukurs, mandeles", "pasterizēts PIENS]",
    "pildījums (cukurs, āboli)", "sojas bāze", "sastāvdaļu saraksts atrodams tikai uz produkta iepakojuma"
  ])("does not award whole-base credit or skip an unknown first ingredient: %s", text => {
    expect(base(text)).toBeNull();
  });
  it("requires a supported source language", () => {
    expect(base("pasterizēts piens", "yogurt", "xx")).toBeNull();
  });
  it("keeps milk powder equivalent across Latvian and existing English wording", () => {
    const lv = analyzeIngredients("VĀJPIENA pulveris (28%), cukurs", "lv", "cookie");
    const en = analyzeIngredients("Skimmed milk powder (28%), sugar", "en", "cookie");
    expect(lv?.score).toBe(40);
    expect(lv?.score).toBe(en?.score);
    expect(base("VĀJPIENA olbaltumvielu pulveris")).toBeNull();
  });
  it("keeps compound sugar evidence and the fixed ceiling after an alias unlock", () => {
    expect(analyzeIngredients("Āboli (cukurs, āboli), mandeles", "lv", "bar")?.score).toBe(40);
    const product = shelfFixture("apple", { category: "Snack bars", ingredientsLanguage: "lv", ingredientsText: "Āboli, mandeles", totalSugarG: 30, fiberG: null });
    const original = structuredClone(product);
    const assessment = assessPersonalShelfProduct(product);
    expect(assessment.status).toBe("provisional");
    expect(assessment.scoreRange!.max).toBeLessThanOrEqual(59);
    expect(product).toEqual(original);
    expect(product.shelfEvidence!.fiberG).toBeNull();
  });
  it("applies source-zero checks to newly unlocked legacy categories too", () => {
    const assessment = assessPersonalShelfProduct(shelfFixture("apple", { ingredientsLanguage: "lv", ingredientsText: "Āboli, cukurs", totalSugarG: 0 }));
    expect(assessment.status).toBe("missing_data");
    expect(assessment.missing).toContain("consistent zero sugar and ingredient list");
    const fat = assessPersonalShelfProduct(shelfFixture("apple", { ingredientsLanguage: "lv", ingredientsText: "Āboli, mandeles", fatG: 20, saturatedFatG: 0 }));
    expect(fat.status).toBe("missing_data");
  });
  it("does not bypass essential missing or contradictory nutrients", () => {
    const common = { ingredientsLanguage: "lv", ingredientsText: "Āboli, mandeles" };
    for (const key of ["energyKcal", "proteinG", "totalSugarG", "saltG", "saturatedFatG"] as const) {
      expect(assessPersonalShelfProduct(shelfFixture("apple", { ...common, [key]: null })).status).toBe("missing_data");
    }
    expect(assessPersonalShelfProduct(shelfFixture("apple", { ...common, proteinG: 50, fatG: 50, carbohydrateG: 50 })).missing).toContain("consistent nutrition totals");
  });
  it("does not score a wafer-cone ice cream or a curd dessert as a cookie", () => {
    const cone = shelfFixture("cone", { category: "Saldētā pārtika/Saldējums un ledus/Saldējums konusa vafelē vai glāzītē", ingredientsLanguage: "lv", ingredientsText: "SALDAIS KRĒJUMS (35%), cukurs" });
    const curd = shelfFixture("curd", { category: "Biscuits", ingredientsLanguage: "en", ingredientsText: "Curd (quark) without lactose 69%, sugar" });
    for (const product of [cone, curd]) {
      expect(assessPersonalShelfProduct(product).missing).toContain("unambiguous product type");
      expect(assessPersonalShelfProduct(product).score).toBeNull();
    }
  });
  it("respects animal share inside parentheses and mechanical separation", () => {
    expect(base("cūku aknas (35%)", "meat-product")?.score).toBe(40);
    expect(base("cāļa fileja 70%", "meat-product")?.score).toBe(70);
    expect(base("cāļa fileja 90%", "meat-product")?.score).toBe(85);
    expect(base("mehāniski atkaulota broileru gaļa", "meat-product")?.score).toBe(40);
    expect(base("cāļa fileja 90%", "cookie")).toBeNull();
    expect(base("cāļa buljons", "meat-product")).toBeNull();
    expect(base("makreles pulveris", "fish-product")).toBeNull();
  });
});
