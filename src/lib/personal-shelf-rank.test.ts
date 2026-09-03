import { describe, expect, it } from "vitest";
import { analyzeIngredients, applyShelfNutritionTrustGuard, assessPersonalShelfProduct, hasContradictoryShelfNutrition, rankPersonalShelfProducts, shelfCategory, splitIngredients, SHELF_CATEGORIES } from "./personal-shelf-rank";
import { scoreBarboraProduct } from "./scoring";
import { shelfFixture } from "../../tests/fixtures/personal-shelf";

describe("Personal Shelf Rank, independent pilot", () => {
  it("uses normalized category weights totaling 100", () => {
    for (const config of Object.values(SHELF_CATEGORIES)) {
      expect(Object.values(config.weights).reduce((a, b) => a + b, 0)).toBe(100);
      expect(Object.values(config.balance).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    }
  });
  it("produces a fixed score with transparent points, without changing legacy Fit", () => {
    const product = shelfFixture();
    const before = structuredClone(product);
    const assessment = assessPersonalShelfProduct(product);
    expect(assessment.score).toBe(77);
    expect(assessment.components.reduce((n, p) => n + p.points, 0)).toBeCloseTo(77.4);
    expect(product).toEqual(before);
    expect(scoreBarboraProduct(product).matchScore).toBe(scoreBarboraProduct({ ...product, shelfEvidence: null }).matchScore);
  });
  it.each(["energyKcal", "proteinG", "totalSugarG", "saltG", "saturatedFatG", "ingredientsText"] as const)("does not score missing %s", (key) => {
    const result = assessPersonalShelfProduct(shelfFixture("qa", { [key]: null }));
    expect(result.status).toBe("missing_data");
    expect(result.score).toBeNull();
  });
  it("bounds absent fiber without fabricating a precise score or nutrient", () => {
    const product = shelfFixture("qa", { fiberG: null });
    const before = structuredClone(product);
    const result = assessPersonalShelfProduct(product);
    expect(result.status).toBe("provisional");
    expect(result.score).toBeNull();
    expect(result.scoreRange).toEqual({ min: 71, max: 81 });
    expect(result.tradeoffs).not.toContain("Less than 3 g fiber per 100 g");
    expect(product).toEqual(before);
    for (const fiberG of [0, .1, 1, 2.99, 4, 6, 20]) {
      const complete = assessPersonalShelfProduct(shelfFixture("qa", { fiberG }));
      expect(complete.score).toBeGreaterThanOrEqual(result.scoreRange!.min);
      expect(complete.score).toBeLessThanOrEqual(result.scoreRange!.max);
    }
  });
  it.each([NaN, Infinity, -1, 101, undefined])("does not treat invalid fiber as a missing optional value: %s", (fiberG) => {
    const result = assessPersonalShelfProduct(shelfFixture("qa", { fiberG }));
    expect(result.status).toBe("missing_data");
    expect(result.scoreRange).toBeNull();
  });
  it("applies limiting ceilings to both ends, without hiding provisional status", () => {
    const result = assessPersonalShelfProduct(shelfFixture("qa", { fiberG: null, saltG: 1.6, proteinG: 25, ingredientsText: "Wholegrain oats, salt" }));
    expect(result.status).toBe("provisional");
    expect(result.scoreRange!.max).toBeLessThanOrEqual(59);
    expect(result.score).toBeNull();
    expect(assessPersonalShelfProduct(shelfFixture("qa", { fiberG: null, saltG: null })).scoreRange).toBeNull();
  });
  it("marks both sides of overlapping intervals as provisional places", () => {
    const ranked = rankPersonalShelfProducts([shelfFixture("partial", { fiberG: null }), shelfFixture("complete")]);
    expect(ranked.groups[0].provisionalCount).toBe(1);
    expect(ranked.groups[0].entries.map((entry) => entry.rankProvisional)).toEqual([true, true]);
    expect(ranked.groups[0].entries.every((entry) => !entry.tied)).toBe(true);
  });
  it.each([NaN, Infinity, -1, 101])("rejects invalid nutrient %s", (saltG) => {
    expect(assessPersonalShelfProduct(shelfFixture("qa", { saltG })).score).toBeNull();
  });
  it("does not require or award optional fiber in yogurt", () => {
    const p = shelfFixture("qa", { category: "Yogurt", ingredientsText: "Milk, cultures", fiberG: null, energyKcal: 100 });
    const a = assessPersonalShelfProduct(p);
    const b = assessPersonalShelfProduct({ ...p, shelfEvidence: { ...p.shelfEvidence!, fiberG: 20 } });
    expect(a.status).toBe("scored");
    expect(a.score).toBe(b.score);
  });
  it("keeps zero distinct from missing and rejects inconsistent energy", () => {
    expect(assessPersonalShelfProduct(shelfFixture("qa", { saltG: 0, saturatedFatG: 0, totalSugarG: 0 })).status).toBe("scored");
    expect(assessPersonalShelfProduct(shelfFixture("qa", { proteinG: 90, energyKcal: 10 })).score).toBeNull();
  });
  it("quarantines an impossible source table in both models without correcting guessed decimals", () => {
    const p = shelfFixture("qa", { proteinG: 57.8, carbohydrateG: 47, fatG: 29, energyKcal: 489 });
    expect(hasContradictoryShelfNutrition(p.shelfEvidence)).toBe(true);
    expect(assessPersonalShelfProduct(p).missing).toContain("consistent nutrition totals");
    expect(applyShelfNutritionTrustGuard(p).matchScore).toBeNull();
    expect(applyShelfNutritionTrustGuard(p).shelfEvidence?.proteinG).toBe(57.8);
    expect(applyShelfNutritionTrustGuard(p).nutrientsPer100g.proteinG).toBeNull();
    expect(applyShelfNutritionTrustGuard(shelfFixture()).matchScore).toBe(60);
    expect(hasContradictoryShelfNutrition({ ...p.shelfEvidence!, proteinG: 5, carbohydrateG: 47, fatG: 29 })).toBe(false);
    expect(hasContradictoryShelfNutrition({ ...p.shelfEvidence!, proteinG: 5, carbohydrateG: 0, totalSugarG: 20, fatG: 29 })).toBe(true);
    expect(hasContradictoryShelfNutrition({ ...p.shelfEvidence!, proteinG: 5, carbohydrateG: 47, fatG: 1, saturatedFatG: 10 })).toBe(true);
  });
  it.each([{ totalSugarG: 30 }, { saltG: 2 }, { saturatedFatG: 6 }])("protein does not cancel a high limiting nutrient", (overrides) => {
    const a = assessPersonalShelfProduct(shelfFixture("qa", { ...overrides, proteinG: 50, fiberG: 10, ingredientsText: "Wholegrain oats, salt" }));
    expect(a.score).toBeLessThanOrEqual(59);
    expect(a.cap).toContain("59/100");
  });
  it("recognizes source categories and refuses ambiguous/drink/unknown categories", () => {
    expect(shelfCategory("Maistas > Užkandžiai > Traškučiai")).toBe("chips");
    expect(shelfCategory("Piena produkti/Jogurti un deserti/Jogurts ar piedevām")).toBe("yogurt");
    expect(shelfCategory("Snack bars and cookies")).toBeNull();
    expect(shelfCategory("Dzeramais jogurts")).toBeNull();
    expect(shelfCategory("Grocery")).toBeNull();
  });
  it.each(["Breakfast cereals", "Maistas > Dribsniai, košės, sausi pusryčiai > Sausi pusryčiai", "Brokastu pārslas", "iepakota-partika > brokastu-parslas-un-musli > musli", "Müsli", "Granola", "Сухие завтраки", "Мюсли", "Hommikuhelbed"])("recognizes a dry breakfast source category: %s", (category) => {
    expect(shelfCategory(category)).toBe("breakfast-cereal");
  });
  it.each(["Cereals and their products", "Dribsniai ir košės", "Avižinė košė", "Breakfast cereals with milk", "Baby food > Breakfast cereals", "Cereal drinks", "Cereals / Porridge"])("keeps broad, prepared and infant categories unsupported: %s", (category) => {
    expect(shelfCategory(category)).toBeNull();
  });
  it("does not confuse cereal bars with loose breakfast cereal", () => {
    expect(shelfCategory("Cereal bars")).toBe("bar");
    expect(shelfCategory("Saldumi-un-uzkodas > batonini > musli")).toBe("bar");
    expect(shelfCategory("Breakfast cereals", "bar")).toBe("bar");
  });
  it.each([["Seeds (sunflower seeds, pumpkin seeds), salt", "en"], ["Sėklos (saulėgrąžų sėklos, moliūgų sėklos), druska", "lt"], ["Sēklas (saulespuķu sēklas), sāls", "lv"], ["Семена подсолнечника, соль", "ru"], ["Päevalilleseemned, sool", "et"]])("recognizes explicit seed bases in %s", (text, language) => {
    expect(analyzeIngredients(text, language)?.score).toBe(100);
  });
  it("does not turn seed oil or isolated seed protein into whole-seed credit", () => {
    expect(analyzeIngredients("Sunflower seed oil, salt", "en")?.score).toBeNull();
    expect(analyzeIngredients("Pumpkin seed protein, salt", "en")?.score).toBe(25);
  });
  it("rates dry cereals separately and keeps missing fiber bounded and essentials unknown", () => {
    const cereal = shelfFixture("cereal", { category: "Breakfast cereals", ingredientsText: "Wholegrain oats, salt", fiberG: null });
    const result = assessPersonalShelfProduct(cereal);
    expect(result.status).toBe("provisional");
    expect(result.scoreRange!.max - result.scoreRange!.min).toBeLessThanOrEqual(10);
    for (const fiberG of [0, 3, 6]) {
      const full = assessPersonalShelfProduct({ ...cereal, shelfEvidence: { ...cereal.shelfEvidence!, fiberG } });
      expect(full.score).toBeGreaterThanOrEqual(result.scoreRange!.min);
      expect(full.score).toBeLessThanOrEqual(result.scoreRange!.max);
    }
    expect(assessPersonalShelfProduct({ ...cereal, shelfEvidence: { ...cereal.shelfEvidence!, saltG: null } }).scoreRange).toBeNull();
    expect(assessPersonalShelfProduct({ ...cereal, shelfEvidence: { ...cereal.shelfEvidence!, nutritionBasis: "100ml" } }).status).toBe("unsupported");
    const groups = rankPersonalShelfProducts([cereal, shelfFixture("chips")]).groups;
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.entries[0].rank === null)).toBe(true);
  });
  it("separates categories, excludes missing values from denominator and shares ties", () => {
    const a = shelfFixture("a"); const b = shelfFixture("b");
    const c = shelfFixture("c", { saltG: 1 });
    const missing = shelfFixture("d", { saltG: null });
    const yogurt = shelfFixture("y", { category: "Yogurt", ingredientsText: "Milk, cultures" });
    const input = [a, b, c, missing, yogurt];
    const ranked = rankPersonalShelfProducts(input);
    const chips = ranked.groups.find((g) => g.category === "chips")!;
    expect(chips.scoredCount).toBe(3);
    expect(chips.total).toBe(4);
    expect(chips.entries.map((e) => e.rank)).toEqual([1, 1, 3, null]);
    expect(chips.entries[0].tied).toBe(true);
    expect(ranked.groups.find((g) => g.category === "yogurt")!.entries[0].rank).toBeNull();
    expect(rankPersonalShelfProducts([...input].reverse())).toEqual(ranked);
  });
  it("deduplicates the same SKU and never uses translated marketing names as scoring input", () => {
    const p = shelfFixture();
    const translated = { ...p, name: "Картофельные чипсы", shortName: "Чипсы", aliases: ["Bulvių traškučiai"] };
    expect(assessPersonalShelfProduct(translated)).toEqual(assessPersonalShelfProduct(p));
    expect(rankPersonalShelfProducts([p, translated]).groups[0].total).toBe(1);
  });
  it("requires the exact product and a supported language", () => {
    expect(assessPersonalShelfProduct(shelfFixture("a", { productId: "b" })).score).toBeNull();
    expect(assessPersonalShelfProduct(shelfFixture("a", { ingredientsLanguage: "xx" })).score).toBeNull();
    expect(assessPersonalShelfProduct(shelfFixture("a", { nutritionBasis: "100ml" })).score).toBeNull();
    expect(assessPersonalShelfProduct(shelfFixture("a", { sourceUrl: "https://barbora.lv.evil.example/qa" })).score).toBeNull();
    expect(assessPersonalShelfProduct(shelfFixture("a", { sourceUrl: "javascript:alert(1)" })).score).toBeNull();
    expect(assessPersonalShelfProduct(shelfFixture("a", { category: "Yogurt", ingredientsText: "BIEZPIENS, jogurts", ingredientsLanguage: "lv" })).missing).toContain("unambiguous product type");
  });
  it("does not change with price, no-added-sugar marketing or extra E-numbers", () => {
    const p = shelfFixture();
    const changed = { ...p, price: 999, noAddedSugarClaim: true, shelfEvidence: { ...p.shelfEvidence!, ingredientsText: "Potatoes, sunflower oil, salt, E300, E440" } };
    expect(assessPersonalShelfProduct(changed).score).toBe(assessPersonalShelfProduct(p).score);
  });
});

describe("bounded multilingual ingredient evidence", () => {
  it.each([["en", "Potatoes, sunflower oil, salt"], ["lv", "Kartupeļi, saulespuķu eļļa, sāls"], ["lt", "Sudedamosios dalys: bulvės, saulėgrąžų aliejus, druska"], ["ru", "Состав: картофель, подсолнечное масло, соль"], ["et", "Koostisosad: kartul, päevalilleõli, sool"]])("matches equivalent %s ingredient bases", (language, text) => {
    expect(analyzeIngredients(text, language)?.score).toBe(75);
  });
  it("does not split percentages or compound ingredient lists", () => {
    expect(splitIngredients("Milk, fruit 12,5% (fruit, sugar), cultures")).toHaveLength(3);
    expect(analyzeIngredients("Milk, fruit (sugar, raspberries), cultures", "en")?.score).toBe(40);
  });
  it("unknown first ingredient stays unknown, absence of sugar does not prove no added sugar", () => {
    expect(analyzeIngredients("Mystery base, salt", "en")?.score).toBeNull();
    expect(analyzeIngredients("Milk, cultures", "en")).not.toHaveProperty("noAddedSugar");
  });
  it("does not confuse extracted starch, protein or oil with the whole food", () => {
    expect(analyzeIngredients("Potato starch, salt", "en")?.score).toBe(25);
    expect(analyzeIngredients("Chickpea protein, salt", "en")?.score).toBe(25);
    expect(analyzeIngredients("Milk protein, cultures", "en")?.score).toBe(25);
    expect(analyzeIngredients("Kokosriekstu eļļa, sāls", "lv")?.score).toBeNull();
    expect(analyzeIngredients("Wholegrain flour, salt", "en")?.score).toBe(100);
  });
  it.each([
    ["en", "Milk chocolate (maltitol, cocoa butter, milk powder), milk protein"],
    ["lv", "PIENA šokolāde ar saldinātāju (maltīts, kakao sviests, piena pulveris), PIENA olbaltumvielas"],
    ["lt", "Pieniškas šokoladas, pieno baltymai"],
    ["ru", "Молочный шоколад, молочный белок"],
    ["et", "Piimašokolaad, piimavalk"]
  ])("treats a %s chocolate compound as a refined base, not plain milk", (language, text) => {
    expect(analyzeIngredients(text, language)?.score).toBe(25);
  });
  it("recognizes the Latvian maltitol label without penalizing sweeteners as sugar", () => {
    const result = analyzeIngredients("PIENA šokolāde (saldinātājs maltīts, kakao sviests), ūdens", "lv");
    expect(result?.sweetenersDetected).toBe(true);
    expect(result?.sugarNearStart).toBe(false);
    expect(analyzeIngredients("Milk, chocolate", "en")?.score).toBe(85);
  });
});
