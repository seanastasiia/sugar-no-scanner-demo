import type { ShelfEvidence } from "@/lib/personal-shelf-rank";
import { normalizeIngredientText } from "@/lib/personal-shelf-rank";
import type { BarboraPageProduct } from "./barbora-catalog";
import { parseLivinnProductIdentity, parseRimiProductPage, rimiDetails } from "./retailer-page-parser";

export function ingredientPlainText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ").replace(/&scaron;/g, "š").replace(/&Scaron;/g, "Š")
    .replace(/&ndash;|&mdash;/g, "-").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ").trim();
}

function strictAmount(text: string, label: string): number | null {
  const match = normalizeIngredientText(text).match(new RegExp(`(?:${label})\\s*:?\\s*(\\d+(?:[.,]\\d+)?)\\s*g(?:\\b|[.,;)])`, "i"));
  return match ? Number(match[1].replace(",", ".")) : null;
}

export function livinnShelfEvidence(html: string, url: string, expectedSku: string, checkedAt: string): ShelfEvidence | null {
  const identity = parseLivinnProductIdentity(html, url, checkedAt);
  if (!identity || identity.sourceProductId !== expectedSku) return null;
  // Exact labelled blocks only, never navigation, nearby products, claims or brand descriptions.
  const block = (heading: string) => html.match(new RegExp(`<h3[^>]*>\\s*${heading}\\s*<\\/h3>\\s*<div[^>]*class=["'][^"']*html-block[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`, "i"))?.[1] || "";
  const nutrition = ingredientPlainText(block("Maistinė vertė"));
  const ingredients = ingredientPlainText(block("Sudėtis"));
  if (!/100\s*g\b/.test(nutrition) || /100\s*ml\b/i.test(nutrition)) return null;
  const kcal = normalizeIngredientText(nutrition).match(/(\d+(?:[.,]\d+)?)\s*kcal\b/);
  return {
    productId: `livinn_lt:${expectedSku}`, source: "livinn_lt", sourceUrl: url, checkedAt,
    gtin: identity.gtin, category: identity.category, nutritionBasis: "100g",
    ingredientsText: ingredients || null, ingredientsLanguage: "lt",
    energyKcal: kcal ? Number(kcal[1].replace(",", ".")) : null,
    proteinG: strictAmount(nutrition, "baltymu|baltymai"), totalSugarG: strictAmount(nutrition, "cukru|cukrus"),
    fiberG: strictAmount(nutrition, "skaiduliniu medziagu|skaidulines medziagos|skaidulu"),
    saltG: strictAmount(nutrition, "druskos|druska"),
    saturatedFatG: strictAmount(nutrition, "sociuju riebalu rugsciu|sociosios riebalu rugstys|sociuju riebalu|sociuju"),
    carbohydrateG: strictAmount(nutrition, "angliavandeniu|angliavandeniai"), fatG: strictAmount(nutrition, "riebalu|riebalai")
  };
}

export function barboraShelfEvidence(product: BarboraPageProduct, checkedAt: string): ShelfEvidence | null {
  if (product.is_adult) return null;
  const nutrient = (label: RegExp, unit = "g") => {
    const row = product.nutrients?.find((entry) => label.test(normalizeIngredientText(entry.Name)));
    const amount = row?.Amounts.find((entry) => entry.UnitName.toLowerCase() === unit)?.Amount;
    return typeof amount === "number" && Number.isFinite(amount) && amount >= 0 ? amount : null;
  };
  return {
    productId: `barbora:${product.Url}`, source: "barbora_lv", sourceUrl: `https://barbora.lv/produkti/${product.Url}`,
    checkedAt, gtin: null, category: product.category_name_full_path || "",
    nutritionBasis: product.comparative_unit === "l" ? "100ml" : "100g",
    ingredientsText: product.ingredients ? ingredientPlainText(product.ingredients) : null, ingredientsLanguage: "lv",
    energyKcal: nutrient(/energetiska vertiba/, "kcal"), proteinG: nutrient(/^olbaltumvielas$/),
    totalSugarG: nutrient(/^cukuri$/), fiberG: nutrient(/skiedrvielas/),
    saltG: nutrient(/^sals$/), saturatedFatG: nutrient(/piesatinatas taukskabes/), carbohydrateG: nutrient(/^oglhidrati$/), fatG: nutrient(/^tauki$/)
  };
}

export function offShelfEvidence(product: Record<string, unknown>, checkedAt: string): ShelfEvidence | null {
  if (typeof product.code !== "string" || !/^\d{8,14}$/.test(product.code)) return null;
  const n = (product.nutriments || {}) as Record<string, unknown>;
  const number = (key: string) => typeof n[key] === "number" && Number.isFinite(n[key]) && n[key] >= 0 ? n[key] as number : null;
  const supported = ["en", "lv", "lt", "ru", "et"];
  let language = typeof product.ingredients_lc === "string" ? product.ingredients_lc : typeof product.lang === "string" ? product.lang : null;
  let text = typeof product.ingredients_text === "string" ? product.ingredients_text : null;
  if (!text || !language || !supported.includes(language)) {
    language = supported.find((lang) => typeof product[`ingredients_text_${lang}`] === "string" && (product[`ingredients_text_${lang}`] as string).trim()) || null;
    text = language ? product[`ingredients_text_${language}`] as string : text;
  }
  const kj = number("energy-kj_100g");
  const salt = number("salt_100g");
  const sodium = number("sodium_100g");
  return {
    productId: `off:${product.code}`, source: "open_food_facts", sourceUrl: `https://world.openfoodfacts.org/product/${product.code}`,
    checkedAt, gtin: product.code, category: typeof product.categories === "string" ? product.categories : "",
    nutritionBasis: product.nutrition_data_per === "100ml" ? "100ml" : "100g",
    ingredientsText: text?.trim() || null, ingredientsLanguage: language,
    energyKcal: number("energy-kcal_100g") ?? (kj === null ? null : Math.round(kj / 4.184 * 10) / 10),
    proteinG: number("proteins_100g"), totalSugarG: number("sugars_100g"), fiberG: number("fiber_100g"),
    saltG: salt ?? (sodium === null ? null : Math.round(sodium * 2.5 * 10000) / 10000),
    saturatedFatG: number("saturated-fat_100g"), carbohydrateG: number("carbohydrates_100g"), fatG: number("fat_100g")
  };
}

/** Rimi URL breadcrumbs include the product slug last. It is not a category. */
export function rimiShelfCategory(url: string): string {
  try {
    const path = new URL(url).pathname.split("/produkti/")[1]?.split("/p/")[0];
    return path?.split("/").slice(0, -1).join(" > ") || "";
  } catch { return ""; }
}

export function rimiShelfEvidence(html: string, url: string, expectedSku: string, checkedAt: string): ShelfEvidence | null {
  const product = parseRimiProductPage(html, url, checkedAt);
  if (!product || product.sourceProductId !== expectedSku || !new URL(url).pathname.endsWith(`/p/${expectedSku}`)) return null;
  const details = rimiDetails(html);
  const tables = [...details.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)]
    .map((match) => match[1]).filter((table) => /uzturvertiba/.test(normalizeIngredientText(ingredientPlainText(table))));
  if (tables.length !== 1) return null;
  const table = tables[0];
  const tableText = ingredientPlainText(table);
  const mixedBasis = /100\s*g\s*\/\s*ml/i.test(tableText);
  const solidPack = /\b\d+(?:[.,]\d+)?\s*(?:kg|g)\b/i.test(product.packSize);
  const liquidPack = /\b\d+(?:[.,]\d+)?\s*(?:ml|cl|l)\b/i.test(product.packSize);
  if (mixedBasis ? !solidPack && !liquidPack : !/100\s*g\b|100\s*ml\b/i.test(tableText)) return null;
  const cells = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap((row) => {
    const values = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => ingredientPlainText(cell[1]));
    return values.length === 2 ? [{ label: normalizeIngredientText(values[0]), value: values[1] }] : [];
  });
  const amount = (label: RegExp, energy = false) => {
    const matches = cells.filter((cell) => label.test(cell.label));
    if (matches.length !== 1) return null;
    const match = matches[0].value.match(energy
      ? /^(?:\d+(?:[.,]\d+)?\s*kJ\s*\/\s*)?(\d+(?:[.,]\d+)?)\s*kcal$/i
      : /^(\d+(?:[.,]\d+)?)\s*g$/i);
    return match ? Number(match[1].replace(",", ".")) : null;
  };
  const ingredients = details.match(/<p\b[^>]*class=["'][^"']*heading[^"']*["'][^>]*>\s*Sastāvdaļas\s*<\/p>\s*<ul\b[^>]*>([\s\S]*?)<\/ul>/i)?.[1];
  return {
    productId: `rimi_lv:${expectedSku}`, source: "rimi_lv", sourceUrl: url, checkedAt,
    gtin: product.gtin, category: rimiShelfCategory(url),
    nutritionBasis: mixedBasis ? solidPack ? "100g" : "100ml" : /100\s*ml\b/i.test(tableText) ? "100ml" : "100g",
    ingredientsText: ingredients ? ingredientPlainText(ingredients) : null, ingredientsLanguage: "lv",
    energyKcal: amount(/^energetiska vertiba$/, true), proteinG: amount(/^olbaltumvielas$/),
    totalSugarG: amount(/^(?:tostarp|t\.\s*sk\.)\s+cukuri$/), fiberG: amount(/^skiedrvielas$/),
    saltG: amount(/^sals$/), saturatedFatG: amount(/^(?:tostarp|t\.\s*sk\.)\s+piesatinatas taukskabes$/),
    carbohydrateG: amount(/^oglhidrati$/), fatG: amount(/^tauki$/)
  };
}
