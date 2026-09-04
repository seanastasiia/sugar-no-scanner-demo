import { createHash } from "node:crypto";
import type { ProductRecord } from "@/lib/types";
import { normalizeRetailText, type BarboraLookupInput } from "./barbora-catalog";
import { parseRimiProductPage } from "./retailer-page-parser";
import { livinnShelfEvidence, rimiShelfEvidence } from "./personal-shelf-parser";
import type { ShelfEvidence } from "@/lib/personal-shelf-rank";

export type WebProductLookup = BarboraLookupInput & { barcode?: string };
export interface VerifiedWebProduct {
  identityKey: string;
  product: ProductRecord & { canonicalShelfEvidence?: ShelfEvidence };
}

// Reviewed retailer hosts only. OFF remains in its separate ODbL layer. New
// sources require an explicit server configuration and parser/rights review.
const defaultHosts = "barbora.lv,www.barbora.lv,rimi.lv,www.rimi.lv,livin.lv,www.livin.lv,livinn.lt,www.livinn.lt";
export function approvedWebProductUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const hosts = (process.env.SHARED_WEB_SOURCE_HOSTS || defaultHosts).split(",").map((host) => host.trim().toLowerCase());
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !hosts.includes(url.hostname) || url.pathname === "/" ||
      /(^|\.)openfoodfacts\.(org|net)$/.test(url.hostname) ||
      /^(localhost|[\d.]+|\[)/.test(url.hostname)) return null;
    url.hash = "";
    // Keep functional parameters: they can select a different SKU.
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_|^(gclid|fbclid)$/.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.href;
  } catch { return null; }
}

export function webLookupKey(input: WebProductLookup): string {
  // Separators preserve field boundaries; percentages/decimal variants must not
  // collapse into other identities. Never use arbitrary searchTerms as aliases.
  return "page-v1:" + JSON.stringify([input.brand, input.name, input.variant, input.packSize, input.barcode || ""]
    .map((value) => normalizeRetailText(value)));
}

export function validWebGtin(value: unknown): string | null {
  if (typeof value !== "string" || !/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value) || /^0+$/.test(value)) return null;
  const digits = [...value].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 ? 1 : 3), 0);
  return (10 - sum % 10) % 10 === check ? value.padStart(14, "0") : null;
}

function text(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&scaron;/g, "š").replace(/&Scaron;/g, "Š").replace(/&ndash;|&mdash;/gi, "–").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const point = Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : " ";
    }).replace(/\s+/g, " ").trim();
}

export function webPack(value: string): { key: string; amount: number; unit: "g" | "ml" } | null {
  const normalized = value.toLowerCase().replaceAll("×", "x").replace(/кг/g, "kg").replace(/мл/g, "ml").replace(/г(?!\p{L})/gu, "g").replace(/л(?!\p{L})/gu, "l");
  const matches = [...normalized.matchAll(/(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|ml|cl|g|l)(?!\p{L})/gu)];
  const packs = matches.map((match) => {
    const amount = Number(match[2].replace(",", ".")) * (/kg|^l$/.test(match[3]) ? 1000 : match[3] === "cl" ? 10 : 1);
    const count = Number(match[1] || "1");
    const unit = /l/.test(match[3]) ? "ml" as const : "g" as const;
    return { key: `${count}x${amount}${unit}`, amount: count * amount, unit };
  });
  return packs.length && packs.every((pack) => pack.key === packs[0].key) && packs[0].amount > 0 ? packs[0] : null;
}

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}
function jsonProducts(html: string): JsonObject[] {
  const values: JsonObject[] = [];
  function visit(value: unknown) {
    if (Array.isArray(value)) return value.forEach(visit);
    const item = object(value);
    if (!item) return;
    if ([item["@type"]].flat().includes("Product")) values.push(item);
    if (item["@graph"]) visit(item["@graph"]);
    if (item.mainEntity) visit(item.mainEntity);
  }
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { /* A broken block is not evidence. */ }
  }
  return values;
}

type Nutrient = "energy" | "protein" | "sugar" | "carbohydrate" | "fiber" | "fat";
type Nutrition = Record<Nutrient, number | null> & { basis: "100g" | "100ml" | null };
const emptyNutrition = (): Nutrition => ({ energy: null, protein: null, sugar: null, carbohydrate: null, fiber: null, fat: null, basis: null });
const labels: Record<Nutrient, RegExp> = {
  energy: /^(energy|energetiska vertiba|energetine verte|energiya|energeticheskaya tsennost|energeticheskaya cennost)$/,
  protein: /^(protein|proteins|olbaltumvielas|baltymai|baltymu|belki)$/,
  sugar: /^(sugars|total sugars|of which sugars|tostarp cukuri|t sk cukuri|cukuri|is kuriu cukru|cukru|sahar|sahara|iz nih sahara)$/,
  carbohydrate: /^(carbohydrate|carbohydrates|oglhidrati|angliavandeniai|angliavandeniu|uglevody)$/,
  fiber: /^(fibre|fiber|dietary fibre|skiedrvielas|skaidulines medziagos|kletchatka)$/,
  fat: /^(fat|total fat|tauki|riebalai|zhiry)$/
};
function amount(value: unknown, energy = false): number | null {
  if (typeof value !== "string") return null;
  const cleaned = text(value).replace(",", ".");
  const match = cleaned.match(energy
    ? /^(?:\d+(?:\.\d+)?\s*kJ\s*[/·-]\s*)?(\d+(?:\.\d+)?)\s*(?:kcal|ккал)$/i
    : /^(\d+(?:\.\d+)?)\s*(?:g|г)$/i);
  if (!match) return null;
  const result = Number(match[1]);
  return result <= (energy ? 1000 : 100) ? result : null;
}
function basis(value: string): Nutrition["basis"] {
  const matches = [...text(value).matchAll(/\b100\s*(g|ml)(?!\p{L})/giu)].map((match) => `100${match[1].toLowerCase()}`);
  return matches.length && new Set(matches).size === 1 ? matches[0] as Nutrition["basis"] : null;
}
function pageNutrition(html: string, product: JsonObject): Nutrition {
  const observations: Nutrition[] = [];
  const structured = object(product.nutrition);
  if (structured && /^(?:100\s*g|100\s*ml)$/i.test(String(structured.servingSize || "").trim())) {
    observations.push({
      basis: basis(String(structured.servingSize)), energy: amount(structured.calories, true),
      protein: amount(structured.proteinContent), sugar: amount(structured.sugarContent),
      carbohydrate: amount(structured.carbohydrateContent), fiber: amount(structured.fiberContent), fat: amount(structured.fatContent)
    });
  }
  // Rimi embeds its actual details table as JSON text in a script, not the DOM.
  const encodedDetails = html.match(/identifier:\s*['"]details['"][\s\S]{0,3000}?html:\s*("(?:\\.|[^"\\])*")/)?.[1];
  let tablesHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  if (encodedDetails) { try { tablesHtml += JSON.parse(encodedDetails); } catch { /* Unknown stays unknown. */ } }
  // Livin/Livinn publish a single labelled per-100 paragraph, not a table.
  // Every value must immediately follow its own label; never scan forward into
  // the next nutrient, use "less than" as an equality, or read page-wide numbers.
  const paragraphLabels: Record<Exclude<Nutrient, "energy">, string> = {
    protein: "baltym(?:ų|ai)|olbaltumvielas|белки|proteins?",
    sugar: "(?:jų |kurių )?cukr(?:ų|us)|(?:t\\.\\s*sk\\.\\s*)?cukuri|сахар(?:а)?|(?:total )?sugars",
    carbohydrate: "angliavanden(?:ių|iai)|ogļhidrāti|углеводы|carbohydrates?",
    fiber: "skaidulinių medžiagų|skaidulinės medžiagos|šķiedrvielas|клетчатка|(?:dietary )?fib(?:er|re)",
    fat: "riebal(?:ų|ai)|tauki|жиры|(?:total )?fat"
  };
  for (const match of tablesHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const paragraph = text(match[1]);
    const heading = paragraph.match(/^(?:maistinė vertė|uzturvērtība|пищевая ценность|nutrition)\s*\(?\s*100\s*(?:g|ml|г|мл)\s*\)?\s*[–\-:]\s*/i)?.[0];
    if (!heading) continue;
    const per100 = basis(paragraph.replace(/мл/gi, "ml").replace(/г(?=\s*\))/gi, "g"));
    if (!per100) continue;
    const observation = { ...emptyNutrition(), basis: per100 };
    const energyText = paragraph.slice(heading.length).match(/^((?:\d+(?:[.,]\d+)?\s*kJ\s*[/·-]\s*)?\d+(?:[.,]\d+)?\s*(?:kcal|ккал))\s*[:,;]/i)?.[1];
    observation.energy = energyText ? amount(energyText, true) : null;
    for (const field of Object.keys(paragraphLabels) as Exclude<Nutrient, "energy">[]) {
      const pattern = new RegExp(`(?:^|[\\s,(;])(?:${paragraphLabels[field]})\\s*:?\\s*(\\d+(?:[.,]\\d+)?\\s*(?:g|г))(?=[\\s,).;]|$)`, "gi");
      const values = [...new Set([...paragraph.matchAll(pattern)].map((item) => amount(item[1])).filter((value) => value !== null))];
      observation[field] = values.length === 1 ? values[0] : null;
    }
    observations.push(observation);
  }
  for (const match of tablesHtml.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const table = match[1];
    const heading = tablesHtml.slice(Math.max(0, match.index! - 100), match.index);
    const per100 = basis(table) || (/100\s*(g|ml)\s*\)?\s*<\/[^>]+>\s*$/i.test(heading) ? basis(heading) : null);
    if (!per100) continue;
    const observation = { ...emptyNutrition(), basis: per100 };
    const seen = new Set<Nutrient>();
    for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => text(cell[1]));
      // Multiple portions/columns must get a dedicated adapter, never a guess.
      if (cells.length !== 2) continue;
      const name = normalizeRetailText(cells[0]);
      const key = (Object.keys(labels) as Nutrient[]).find((field) => labels[field].test(name));
      if (!key) continue;
      const value = amount(cells[1], key === "energy");
      if (seen.has(key) && observation[key] !== value) return emptyNutrition();
      observation[key] = value;
      seen.add(key);
    }
    observations.push(observation);
  }
  if (!observations.length || new Set(observations.map((item) => item.basis)).size !== 1) return emptyNutrition();
  const result = { ...emptyNutrition(), basis: observations[0].basis };
  for (const field of Object.keys(labels) as Nutrient[]) {
    const values = [...new Set(observations.map((item) => item[field]).filter((value) => value !== null))];
    result[field] = values.length === 1 ? values[0] : null;
  }
  if ((result.sugar !== null && result.carbohydrate !== null && result.sugar > result.carbohydrate) ||
    [result.protein, result.carbohydrate, result.fat].reduce<number>((sum, value) => sum + (value || 0), 0) > 101 ||
    (result.energy !== null && result.protein !== null && result.protein * 4 > result.energy + 5)) return emptyNutrition();
  return result;
}

/** Deterministic page evidence only: model-supplied nutrient numbers are unused. */
export function verifyWebProductPage(input: WebProductLookup, html: string, sourceUrl: string, checkedAt = new Date().toISOString()): VerifiedWebProduct | null {
  const url = approvedWebProductUrl(sourceUrl);
  if (!url) return null;
  const products = jsonProducts(html);
  if (products.length !== 1) return null; // No listing or adjacent-card nutrition.
  const page = products[0];
  const name = typeof page.name === "string" ? text(page.name).slice(0, 240) : "";
  const rimiBrand = /(^|\.)rimi\.lv$/.test(new URL(url).hostname) ? parseRimiProductPage(html, url)?.brand : "";
  const brand = text(typeof page.brand === "string" ? page.brand : String(object(page.brand)?.name || rimiBrand || ""));
  if (!name || !brand || normalizeRetailText(brand) !== normalizeRetailText(input.brand)) return null;
  const fixedPack = html.match(/product__fixed-content[\s\S]{0,2400}?text--gray[^>]*>([^<]+)</i)?.[1] || "";
  const pack = webPack(`${name} ${fixedPack}`);
  const observedPack = webPack(input.packSize || input.name);
  if (!pack || (observedPack && observedPack.key !== pack.key) || (input.packSize && !observedPack)) return null;
  const gtins = [page.gtin, page.gtin8, page.gtin12, page.gtin13, page.gtin14].filter((value) => value !== undefined).map(validWebGtin);
  const gtin = gtins.length && gtins.every((value) => value && value === gtins[0]) ? gtins[0] : null;
  const observedGtin = validWebGtin(input.barcode);
  if (input.barcode && (!observedGtin || observedGtin !== gtin)) return null;
  if (!observedGtin) {
    // Without a source-confirmed barcode, translation is not proof of identity.
    // All non-brand/non-pack words (including the variant) must be on the page.
    if (!observedPack) return null;
    const withoutPack = (value: string) => value.replace(/(?:(\d+)\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(?:kg|ml|cl|g|l|кг|мл|г|л)(?!\p{L})/giu, " ");
    const pageWords = new Set(normalizeRetailText(withoutPack(`${brand} ${name}`)).split(" "));
    const queryWords = normalizeRetailText(withoutPack(`${input.name} ${input.variant}`)).split(" ")
      .filter((word) => word && !normalizeRetailText(input.brand).split(" ").includes(word));
    const percentages = (value: string) => [...value.matchAll(/\d+(?:[.,]\d+)?\s*%/g)].map((match) => match[0].replace(",", ".").replaceAll(" ", ""));
    if (percentages(`${input.name} ${input.variant}`).some((value) => !percentages(name).includes(value))) return null;
    if (!queryWords.length || !queryWords.every((word) => pageWords.has(word))) return null;
  }
  let canonicalShelfEvidence: ShelfEvidence | null = null;
  if (process.env.SHARED_WEB_SHELF_EVIDENCE_ENABLED === "true" && typeof page.sku === "string") {
    if (/(^|\.)rimi\.lv$/.test(new URL(url).hostname)) canonicalShelfEvidence = rimiShelfEvidence(html, url, page.sku, checkedAt);
    if (/(^|\.)livinn\.lt$/.test(new URL(url).hostname)) canonicalShelfEvidence = livinnShelfEvidence(html, url, page.sku, checkedAt);
    if (canonicalShelfEvidence?.gtin && gtin && validWebGtin(canonicalShelfEvidence.gtin) !== gtin) canonicalShelfEvidence = null;
  }
  // When supported, every field comes from the same exact labelled observation.
  // Do not assemble a Personal Fit table from different pages or model output.
  const nutrition = canonicalShelfEvidence ? { basis: canonicalShelfEvidence.nutritionBasis, energy: canonicalShelfEvidence.energyKcal,
    protein: canonicalShelfEvidence.proteinG, sugar: canonicalShelfEvidence.totalSugarG, carbohydrate: canonicalShelfEvidence.carbohydrateG ?? null,
    fiber: canonicalShelfEvidence.fiberG, fat: canonicalShelfEvidence.fatG ?? null } : pageNutrition(html, page);
  const identityKey = [new URL(url).hostname.replace(/^www\./, ""), normalizeRetailText(brand), gtin || url, pack.key].join("|");
  const id = `web:shared:${createHash("sha256").update(identityKey).digest("hex").slice(0, 24)}`;
  const fields: ProductRecord["sources"][number]["fields"] = ["identity"];
  if (nutrition.protein !== null) fields.push("protein");
  if (nutrition.sugar !== null) fields.push("totalSugar");
  if (nutrition.fiber !== null) fields.push("fiber");
  if (nutrition.carbohydrate !== null) fields.push("carbohydrate");
  return { identityKey, product: {
    id, retailerProductId: id, brand, name, shortName: name, aliases: [], format: "other", category: null,
    packSizeG: pack.amount, ...(nutrition.basis ? { nutritionBasis: nutrition.basis } : {}), energyKcalPer100: nutrition.energy,
    gtin, nutrientsPer100g: { proteinG: nutrition.protein, totalSugarG: nutrition.sugar, carbohydrateG: nutrition.carbohydrate, fiberG: nutrition.fiber },
    noAddedSugarClaim: false, imageUrl: null, retailerUrl: url, isGolden: false, accent: "coral",
    ...(canonicalShelfEvidence ? { canonicalShelfEvidence } : {}),
    sources: [{ label: `Checked product page · ${new URL(url).hostname}`, url, checkedAt, fields, status: "secondary" }]
  } };
}

export async function fetchVerifiedWebProduct(input: WebProductLookup, sourceUrl: string): Promise<VerifiedWebProduct | null> {
  let url = approvedWebProductUrl(sourceUrl);
  if (!url) return null;
  try {
    const signal = AbortSignal.timeout(5_000);
    for (let redirects = 0; redirects <= 2; redirects++) {
      const response = await fetch(url, { signal, redirect: "manual", headers: { "user-agent": "Sugar.no exact product verification/1.0", accept: "text/html" } });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        url = approvedWebProductUrl(new URL(response.headers.get("location") || "", url).href);
        if (!url) return null;
        continue;
      }
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html") || !response.body) {
        await response.body?.cancel();
        return null;
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 1_500_000) { await reader.cancel(); return null; }
        chunks.push(part.value);
      }
      return verifyWebProductPage(input, Buffer.concat(chunks).toString("utf8"), url);
    }
  } catch { /* Network/unsupported page failure must not become a catalog fact. */ }
  return null;
}
