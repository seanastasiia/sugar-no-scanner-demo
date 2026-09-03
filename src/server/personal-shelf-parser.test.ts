import { describe, expect, it } from "vitest";
import { barboraShelfEvidence, livinnShelfEvidence, offShelfEvidence, rimiShelfCategory, rimiShelfEvidence } from "./personal-shelf-parser";
import { openFoodFactsToScoredProduct } from "./open-food-facts";
import { openFoodFactsBulkRecordToProduct } from "./open-food-facts-bulk";
import { getShelfEvidence } from "./personal-shelf-evidence";
import { getExternalCatalogProductById } from "./external-catalog";
import { getIndexedBarboraNutrition, indexedBarboraProductToScoredProduct } from "./barbora-nutrition-index";
import { analyzeIngredients, shelfCategory } from "@/lib/personal-shelf-rank";

const time = "2026-09-03T09:00:00.000Z";
const page = `<script type="application/ld+json">{"@type":"Product","name":"QA cookies","sku":"qa","gtin13":"1234567890123"}</script>
<script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[{"name":"Home"},{"name":"Maistas"},{"name":"Sausainiai"},{"name":"QA cookies"}]}</script>
<div>Popular nearby product: protein 99 g, salt 99 g</div>
<h3 class="title--s">Sudėtis</h3><div class="html-block"><p>Sudedamosios dalys: pilno grūdo miltai, druska.</p></div>
<h3 class="title--s">Maistinė vertė</h3><div class="html-block"><p>Maistinė vertė (100 g) - 1873 kJ/446 kcal: riebalų 16 g (i&scaron; kurių sočiųjų 2.5 g), angliavandenių 66 g (i&scaron; kurių cukrų 18 g), skaidulinių medžiagų 6.0 g, baltymų 6.6 g, druskos 0.48 g.</p></div>`;

const rimiUrl = "https://www.rimi.lv/e-veikals/lv/produkti/saldumi/cipsi/qa-cipsi-100g/p/100";
function rimiPage(salt = "0.5 g", ingredientsHeading = "Sastāvdaļas", basis = "100g/ml") {
  const details = `<p class="heading">${ingredientsHeading}</p><ul><li><p>Kartupeļi, eļļa, sāls</p></li></ul>
    <table><thead><tr><th>Uzturvērtība</th><th>Daudzums uz ${basis}</th></tr></thead><tbody>${[
      ["enerģētiskā vērtība", "2000 kJ/ 480 kcal"], ["tauki", "20 g"], ["tostarp piesātinātās taukskābes", "1 g"],
      ["ogļhidrāti", "50 g"], ["tostarp cukuri", "2 g"], ["olbaltumvielas", "5 g"], ["sāls", salt]
    ].map(([name,value])=>`<tr><td>${name}</td><td>${value}</td></tr>`).join("")}</tbody></table>`;
  return `<script type="application/ld+json">{"@type":"Product","name":"QA chips 100g","sku":"100","gtin13":"1234567890123"}</script>
    <script>Storefront.product_details_page({identifier:'details', html:${JSON.stringify(details)}})</script>
    <p>Related product: fiber 99 g, salt 99 g</p>`;
}

describe("independent exact-source shelf evidence", () => {
  it("recognizes the exact Latvian flour alias and savory-biscuit taxonomy without translating nutrients", () => {
    expect(analyzeIngredients("KVIEŠU milti, sāls", "lv")?.score).toBe(analyzeIngredients("Wheat flour, salt", "en")?.score);
    expect(analyzeIngredients("KVIEŠU milti, cukurs, sāls", "lv")?.sugarNearStart).toBe(true);
    expect(shelfCategory("saldumi > cepumi-un-vafeles > salie-cepumi")).toBe("crackers");
    expect(shelfCategory("Sālie cepumi")).toBe("crackers");
    expect(shelfCategory("saldie-cepumi")).toBe("cookie");
    expect(shelfCategory("dip-mercu-maisijumi")).toBeNull();
  });
  it("extracts Rimi ingredients and exact labelled table cells, with unknown fiber", () => {
    expect(rimiShelfEvidence(rimiPage(), rimiUrl, "100", time)).toMatchObject({
      source: "rimi_lv", productId: "rimi_lv:100", ingredientsText: "Kartupeļi, eļļa, sāls", ingredientsLanguage: "lv",
      category: "saldumi > cipsi", nutritionBasis: "100g", energyKcal: 480, saltG: .5, fiberG: null, saturatedFatG: 1
    });
    expect(rimiShelfEvidence(rimiPage("&lt;0.1 g"), rimiUrl, "100", time)?.saltG).toBeNull();
    expect(rimiShelfEvidence(rimiPage("0 g"), rimiUrl, "100", time)?.saltG).toBe(0);
  });
  it("refuses missing Rimi ingredients, wrong SKU or serving basis without borrowing neighbors", () => {
    expect(rimiShelfEvidence(rimiPage(), rimiUrl, "wrong", time)).toBeNull();
    expect(rimiShelfEvidence(rimiPage(".5 g", "Related ingredients"), rimiUrl, "100", time)?.ingredientsText).toBeNull();
    expect(rimiShelfEvidence(rimiPage("0.5 g", "Sastāvdaļas", "30g"), rimiUrl, "100", time)).toBeNull();
    expect(rimiShelfCategory("https://www.rimi.lv/e-veikals/lv/produkti/cipsi-un-dip-merces/dip-mercu-maisijumi/mercite-cipsiem/p/101")).toBe("cipsi-un-dip-merces > dip-mercu-maisijumi");
  });
  it("extracts only labelled Livinn blocks including shorthand saturates", () => {
    expect(livinnShelfEvidence(page, "https://www.livinn.lt/p/qa", "qa", time)).toMatchObject({
      productId: "livinn_lt:qa", ingredientsLanguage: "lt", energyKcal: 446, proteinG: 6.6, totalSugarG: 18, fiberG: 6, saltG: .48, saturatedFatG: 2.5, carbohydrateG: 66, fatG: 16
    });
  });
  it("does not use a prepared-with-milk table as dry cereal nutrition", () => {
    expect(livinnShelfEvidence(page.replace("(100 g)", "(100 g paruošto produkto su pienu)"), "https://www.livinn.lt/p/qa", "qa", time)).toBeNull();
    expect(rimiShelfEvidence(rimiPage("0.5 g", "Sastāvdaļas", "100g ar pienu"), rimiUrl, "100", time)).toBeNull();
  });
  it("rejects another SKU, per-serving evidence and missing exact blocks", () => {
    expect(livinnShelfEvidence(page, "https://www.livinn.lt/p/qa", "wrong", time)).toBeNull();
    expect(livinnShelfEvidence(page.replace("(100 g)", "(30 g)"), "https://www.livinn.lt/p/qa", "qa", time)).toBeNull();
    expect(livinnShelfEvidence(page.replace("Maistinė vertė</h3>", "Related product</h3>"), "https://www.livinn.lt/p/qa", "qa", time)).toBeNull();
  });
  it("never invents a missing value or converts less-than labels to exact zero", () => {
    expect(livinnShelfEvidence(page.replace("druskos 0.48 g", "druskos <0.1 g"), "https://www.livinn.lt/p/qa", "qa", time)?.saltG).toBeNull();
    const row = barboraShelfEvidence({ Url: "qa", title: "QA", brand_name: "QA", price: 1, ingredients: "PIENS", nutrients: [] }, time);
    expect(row?.fiberG).toBeNull();
    expect(row?.totalSugarG).toBeNull();
  });
  it("keeps OFF language and data nullable, including documented sodium-to-salt conversion", () => {
    const raw = { code: "1234567890123", product_name: "QA chips", brands: "QA", categories: "Chips", ingredients_text_lt: "Bulvės, druska", nutriments: { "energy-kcal_100g": 400, proteins_100g: 4, sugars_100g: 1, sodium_100g: .2, "saturated-fat_100g": 1 } };
    const e = offShelfEvidence(raw, time);
    expect(e).toMatchObject({ ingredientsLanguage: "lt", ingredientsText: "Bulvės, druska", saltG: .5, fiberG: null });
    expect(openFoodFactsToScoredProduct(raw, time)?.shelfEvidence).toEqual(e);
    expect(openFoodFactsBulkRecordToProduct(raw, time)?.shelfEvidence).toEqual(e);
  });
  it("attaches pilot observations to exact local retailer records without altering Fit", async () => {
    const slug = "bif-jog-karums-avenu-musli-bez-lakt-350-g";
    const indexed = getIndexedBarboraNutrition(slug)!;
    expect(indexedBarboraProductToScoredProduct(indexed).shelfEvidence).toEqual(getShelfEvidence(`barbora:${slug}`));
    const external = await getExternalCatalogProductById("livinn_lt:03000007174");
    expect(external?.shelfEvidence).toEqual(getShelfEvidence("livinn_lt:03000007174"));
    expect(getShelfEvidence("livinn_lt:nonexistent")).toBeNull();
  });
  it("does not reuse the known contradictory Livinn chip table as original Fit", () => {
    const product = getExternalCatalogProductById("livinn_lt:03000011074")!;
    expect(product.shelfEvidence).toMatchObject({ proteinG: 57.8, carbohydrateG: 47, fatG: 29 });
    expect(product.matchScore).toBeNull();
    expect(product.ratingStatus).toBe("identity_only");
    expect(product.nutrientsPer100g.proteinG).toBeNull();
    expect(getExternalCatalogProductById("livinn_lt:03000011072")?.matchScore).not.toBeNull();
  });
});
