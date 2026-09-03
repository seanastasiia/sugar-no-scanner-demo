import type { ExternalCatalogIdentity, ExternalCatalogProduct } from "./external-catalog-types";

interface JsonLdProduct {
  "@type"?: string;
  name?: string;
  sku?: string;
  gtin8?: string;
  gtin12?: string;
  gtin13?: string;
  gtin14?: string;
  brand?: string | { name?: string };
  image?: string | string[] | { url?: string };
  offers?: {
    price?: string | number;
    priceCurrency?: string;
    availability?: string;
    url?: string;
  };
}

interface JsonLdBreadcrumbList {
  "@type"?: string;
  itemListElement?: Array<{ name?: string; item?: string }>;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&Scaron;/g, "Š")
    .replace(/&scaron;/g, "š")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function plainText(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function finite(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function jsonLdValues(html: string): Array<JsonLdProduct | JsonLdBreadcrumbList> {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match): Array<JsonLdProduct | JsonLdBreadcrumbList> => {
      try {
        const value = JSON.parse(match[1]) as JsonLdProduct | JsonLdBreadcrumbList | Array<JsonLdProduct | JsonLdBreadcrumbList>;
        return Array.isArray(value) ? value : [value];
      } catch {
        return [];
      }
    });
}

function jsonLdProducts(html: string): JsonLdProduct[] {
  return jsonLdValues(html).filter((value): value is JsonLdProduct => value["@type"] === "Product");
}

function productImage(product: JsonLdProduct): string | null {
  if (typeof product.image === "string") return product.image;
  if (Array.isArray(product.image)) return product.image[0] || null;
  return product.image?.url || null;
}

function productBrand(product: JsonLdProduct): string {
  if (typeof product.brand === "string") return product.brand;
  return product.brand?.name || "";
}

function productGtin(product: JsonLdProduct): string | null {
  const gtin = product.gtin14 || product.gtin13 || product.gtin12 || product.gtin8 || "";
  return /^\d{8,14}$/.test(gtin) && !/^0+$/.test(gtin) ? gtin : null;
}

function nutritionBasis(text: string): "100g" | "100ml" {
  return /100\s*ml/i.test(text) ? "100ml" : "100g";
}

function nutrient(text: string, labels: RegExp[]): number | null {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label.source}[\\s\\S]{0,80}?(\\d+(?:[.,]\\d+)?)\\s*g`, "i"));
    const value = finite(match?.[1]);
    if (value !== null) return value;
  }
  return null;
}

function energyKcal(text: string): number | null {
  const labelled = text.match(/(?:enerģētiskā vērtība|energy|maistinė vertė|пищевая ценность)[\s\S]{0,160}?(\d+(?:[.,]\d+)?)\s*kcal/i);
  if (labelled) return finite(labelled[1]);
  return finite(text.match(/(?:\d+(?:[.,]\d+)?\s*k[jd]\s*[/·-]\s*)?(\d+(?:[.,]\d+)?)\s*kcal/i)?.[1]);
}

function packFromTitle(title: string): string {
  return title.match(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|ml|cl|l)\b/i)?.[0] || "";
}

function availability(value: string | undefined): boolean | null {
  if (!value) return null;
  if (/outofstock/i.test(value)) return false;
  if (/instock/i.test(value)) return true;
  return null;
}

function decodeJavascriptString(value: string): string | null {
  try {
    return JSON.parse(value) as string;
  } catch {
    return null;
  }
}

export function rimiDetails(html: string): string {
  const start = html.indexOf("Storefront.product_details_page");
  const section = start >= 0 ? html.slice(start, start + 120_000) : html;
  const encoded = section.match(/identifier:\s*['"]details['"][\s\S]{0,3000}?html:\s*("(?:\\.|[^"\\])*")/)?.[1];
  return encoded ? decodeJavascriptString(encoded) || "" : "";
}

function rimiBrand(details: string): string {
  const decoded = plainText(details);
  return decoded.match(/Zīmols\s+([^\n]+?)(?:Ražotājs|Daudzums|Sastāvdaļas)/i)?.[1]?.trim() || "";
}

export function parseRimiProductPage(
  html: string,
  url: string,
  checkedAt = new Date().toISOString()
): ExternalCatalogProduct | null {
  const product = jsonLdProducts(html)[0];
  if (!product?.name || !product.sku) return null;
  const detailsHtml = rimiDetails(html);
  const details = plainText(detailsHtml);
  const energy = energyKcal(details);
  const protein = nutrient(details, [/olbaltumvielas/]);
  const sugar = nutrient(details, [/tostarp cukuri/, /t\.\s*sk\.\s*cukuri/]);
  const carbohydrate = nutrient(details, [/ogļhidrāti/, /oglhidrati/, /carbohydrates?/]);
  if (energy === null || protein === null || sugar === null) return null;
  const price = finite(product.offers?.price);
  const title = plainText(product.name);
  return {
    source: "rimi_lv",
    sourceProductId: product.sku,
    retailer: "Rimi",
    url,
    title,
    brand: rimiBrand(detailsHtml) || title.split(/\s+/)[0] || "Rimi",
    gtin: productGtin(product),
    sku: product.sku,
    category: new URL(url).pathname.split("/p/")[0]?.split("/produkti/")[1]?.replaceAll("/", " > ") || null,
    packSize: packFromTitle(title),
    nutritionBasis: nutritionBasis(details),
    energyKcal: energy,
    proteinG: protein,
    totalSugarG: sugar,
    carbohydrateG: carbohydrate,
    imageUrl: productImage(product),
    price,
    currency: product.offers?.priceCurrency === "EUR" && price !== null ? "EUR" : null,
    available: availability(product.offers?.availability),
    checkedAt
  };
}

export function parseLivinProductPage(
  html: string,
  url: string,
  checkedAt = new Date().toISOString()
): ExternalCatalogProduct | null {
  const product = jsonLdProducts(html)[0];
  if (!product?.name || !product.sku) return null;
  const text = plainText(html);
  const nutritionStart = text.toLowerCase().indexOf("uzturvērtība");
  const nutrition = nutritionStart >= 0 ? text.slice(nutritionStart, nutritionStart + 1_500) : text;
  const energy = energyKcal(nutrition);
  const protein = nutrient(nutrition, [/olbaltumvielas/]);
  const sugar = nutrient(nutrition, [/t\.\s*sk\.\s*cukuri/, /cukuri/]);
  const carbohydrate = nutrient(nutrition, [/ogļhidrāti/, /oglhidrati/, /carbohydrates?/]);
  if (energy === null || protein === null || sugar === null) return null;
  const price = finite(product.offers?.price);
  const title = plainText(product.name);
  const fixedPack = html.match(/product__fixed-content[\s\S]{0,1800}?text--gray[^>]*>([^<]+)</i)?.[1]?.trim();
  return {
    source: "livin_lv",
    sourceProductId: product.sku,
    retailer: "Livin",
    url,
    title,
    brand: productBrand(product) || "Livin",
    gtin: productGtin(product),
    sku: product.sku,
    category: null,
    packSize: fixedPack || packFromTitle(title),
    nutritionBasis: nutritionBasis(nutrition),
    energyKcal: energy,
    proteinG: protein,
    totalSugarG: sugar,
    carbohydrateG: carbohydrate,
    imageUrl: productImage(product),
    price,
    currency: product.offers?.priceCurrency === "EUR" && price !== null ? "EUR" : null,
    available: availability(product.offers?.availability),
    checkedAt
  };
}

function livinnCategory(html: string): string | null {
  const breadcrumbs = jsonLdValues(html).find(
    (value): value is JsonLdBreadcrumbList => value["@type"] === "BreadcrumbList"
  );
  const names = (breadcrumbs?.itemListElement || [])
    .slice(1, -1)
    .map((item) => plainText(item.name || ""))
    .filter(Boolean);
  return names.length ? names.join(" > ") : null;
}

function alternateSlugAliases(html: string, currentUrl: string, sku: string): string[] {
  const current = new URL(currentUrl);
  const normalizedSku = sku.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases = new Map<string, string>();
  for (const match of html.matchAll(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["'][^>]*>/gi)) {
    try {
      const alternate = new URL(decodeHtml(match[1]));
      if (alternate.href === current.href) continue;
      let slug = decodeURIComponent(alternate.pathname.split("/p/")[1] || "")
        .replace(/-lt$/i, "")
        .replace(/-/g, " ")
        .trim();
      if (!slug) continue;
      const words = slug.split(/\s+/);
      while (words.length) {
        const compact = words.at(-1)!.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (compact === normalizedSku || compact === "lt") words.pop();
        else break;
      }
      slug = words.join(" ").trim();
      const key = slug.toLocaleLowerCase();
      if (slug && !aliases.has(key)) aliases.set(key, slug);
    } catch {
      // Ignore malformed alternate metadata without discarding the verified product page.
    }
  }
  return [...aliases.values()];
}

export function parseLivinnProductPage(
  html: string,
  url: string,
  checkedAt = new Date().toISOString()
): ExternalCatalogProduct | null {
  const identity = parseLivinnProductIdentity(html, url, checkedAt);
  if (!identity) return null;
  const text = plainText(html);
  const nutritionStart = text.search(/maistinė vertė|uzturvērtība|пищевая ценность/i);
  const nutrition = nutritionStart >= 0 ? text.slice(nutritionStart, nutritionStart + 1_800) : text;
  const energy = energyKcal(nutrition);
  const protein = nutrient(nutrition, [/baltym(?:ai|ų)/, /olbaltumvielas/, /белк/]);
  const sugar = nutrient(nutrition, [/iš kurių cukrų/, /cukrų/, /t\.\s*sk\.\s*cukuri/, /сахар/]);
  const carbohydrate = nutrient(nutrition, [/angliavanden(?:iai|ių)/, /ogļhidrāti/, /oglhidrati/, /углевод/, /carbohydrates?/]);
  if (energy === null || protein === null || sugar === null) return null;
  return {
    ...identity,
    nutritionBasis: nutritionBasis(nutrition),
    energyKcal: energy,
    proteinG: protein,
    totalSugarG: sugar,
    carbohydrateG: carbohydrate,
    checkedAt: identity.checkedAt
  };
}

export function parseLivinnProductIdentity(
  html: string,
  url: string,
  checkedAt = new Date().toISOString()
): ExternalCatalogIdentity | null {
  const product = jsonLdProducts(html)[0];
  if (!product?.name || !product.sku) return null;
  const category = livinnCategory(html);
  if (!category || !category.toLocaleLowerCase("lt").startsWith("maistas")) return null;
  const price = finite(product.offers?.price);
  const title = plainText(product.name);
  const fixedPack = html.match(/product__fixed-content[\s\S]{0,2400}?text--gray[^>]*>([^<]+)</i)?.[1]?.trim();
  return {
    source: "livinn_lt",
    sourceProductId: product.sku,
    retailer: "Livin",
    url,
    title,
    aliases: alternateSlugAliases(html, url, product.sku),
    brand: plainText(productBrand(product)) || "Livinn",
    gtin: productGtin(product),
    sku: product.sku,
    category,
    packSize: plainText(fixedPack || "") || packFromTitle(`${title} ${url}`),
    imageUrl: productImage(product),
    price,
    currency: product.offers?.priceCurrency === "EUR" && price !== null ? "EUR" : null,
    available: availability(product.offers?.availability),
    checkedAt
  };
}
