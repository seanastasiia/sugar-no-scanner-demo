import type { ExternalCatalogIdentity } from "./external-catalog-types";
import { validWebGtin } from "./web-product-evidence";

export const CSP_SOURCE_URL = "https://www.csp.gov.lv/lv/jaunums/cenu-salidzinasanas-riku-izstradataji-no-1-decembra-vares-sanemt-datus-no-csp";

export interface CspPriceRecord {
  date: string;
  itemName: string;
  gtin: string;
  sourceGtin: string;
  basePricePackage: number;
  basePriceUnit: number;
  discountPrice: number | null;
  quantity: number;
  unit: "kg" | "l" | "gab";
  retailer: "Rimi" | "Lidl" | "Maxima";
  storeType: string | null;
  availability: string | null;
  manufacturer: string | null;
  manufacturerCountry: string | null;
  url: string | null;
  hierarchy: string[];
  description: string | null;
}

export interface CspImportResult {
  records: CspPriceRecord[];
  identities: ExternalCatalogIdentity[];
  rejected: Record<string, number>;
  identityConflicts: string[];
  delimiter: "tab" | "semicolon" | "comma";
}

const requiredHeaders = ["ITEM", "GTIN/EAN", "DATUMS", "PAMATCENA_GAB", "PAMATCENA_VIENIBA", "QUANTITY", "MERVIENIBA", "NOSAUKUMS"];

function parseMatrix(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else value += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  if (quoted) throw new Error("CSP CSV has an unclosed quoted field");
  row.push(value.replace(/\r$/, ""));
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function normalizedHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLocaleUpperCase("lv");
}

function detectedMatrix(text: string): { rows: string[][]; delimiter: CspImportResult["delimiter"] } {
  const headerLine = text.slice(0, text.indexOf("\n") >= 0 ? text.indexOf("\n") : text.length);
  const candidates = [
    { char: "\t", label: "tab" as const },
    { char: ";", label: "semicolon" as const },
    { char: ",", label: "comma" as const }
  ].map((candidate) => {
    const rows = parseMatrix(headerLine, candidate.char);
    const headers = new Set((rows[0] || []).map(normalizedHeader));
    return { ...candidate, rows, matches: requiredHeaders.filter((header) => headers.has(header)).length };
  }).sort((left, right) => right.matches - left.matches || right.rows[0]!.length - left.rows[0]!.length);
  const best = candidates[0]!;
  if (best.matches !== requiredHeaders.length) {
    throw new Error(`Unknown CSP CSV schema; found ${best.matches}/${requiredHeaders.length} required official fields`);
  }
  return { rows: parseMatrix(text, best.char), delimiter: best.label };
}

function decimal(value: string, allowZero = true): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= (allowZero ? 0 : Number.MIN_VALUE) ? number : null;
}

function isoDate(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})\.?$/);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

function retailer(value: string): CspPriceRecord["retailer"] | null {
  const normalized = value.trim().toLocaleLowerCase("lv");
  if (normalized.includes("rimi")) return "Rimi";
  if (normalized.includes("lidl")) return "Lidl";
  if (normalized.includes("maxima")) return "Maxima";
  return null;
}

function sourceUrl(value: string, owner: CspPriceRecord["retailer"]): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const allowed = owner === "Rimi"
      ? ["rimi.lv"]
      : owner === "Lidl"
        ? ["lidl.lv"]
        : ["maxima.lv", "barbora.lv"];
    return allowed.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : null;
  } catch {
    return null;
  }
}

export function parseCspPriceCsv(text: string): CspImportResult {
  const { rows, delimiter } = detectedMatrix(text);
  if (rows.length < 2) throw new Error("CSP CSV has no product rows");
  if (rows.length > 1_000_001) throw new Error("CSP CSV row limit exceeded");
  const headers = rows[0]!.map(normalizedHeader);
  const column = (name: string) => headers.indexOf(name);
  const get = (row: string[], name: string) => row[column(name)]?.trim() || "";
  const rejected: Record<string, number> = {};
  const reject = (reason: string) => { rejected[reason] = (rejected[reason] || 0) + 1; };
  const records = new Map<string, CspPriceRecord>();
  const duplicateConflicts = new Set<string>();
  for (const row of rows.slice(1)) {
    if (row.length !== headers.length) {
      reject("malformed_row");
      continue;
    }
    const sourceGtin = get(row, "GTIN/EAN");
    const gtin = validWebGtin(sourceGtin);
    const itemName = get(row, "ITEM");
    const date = isoDate(get(row, "DATUMS"));
    const owner = retailer(get(row, "NOSAUKUMS"));
    const basePricePackage = decimal(get(row, "PAMATCENA_GAB"), false);
    const basePriceUnit = decimal(get(row, "PAMATCENA_VIENIBA"), false);
    const quantity = decimal(get(row, "QUANTITY"), false);
    const unit = get(row, "MERVIENIBA").toLocaleLowerCase("lv");
    if (!gtin) { reject("invalid_gtin"); continue; }
    if (!itemName) { reject("missing_name"); continue; }
    if (!date) { reject("invalid_date"); continue; }
    if (!owner) { reject("unknown_retailer"); continue; }
    if (basePricePackage === null || basePriceUnit === null) { reject("invalid_price"); continue; }
    if (quantity === null || !["kg", "l", "gab"].includes(unit)) { reject("invalid_quantity"); continue; }
    const record: CspPriceRecord = {
      date,
      itemName,
      gtin,
      sourceGtin,
      basePricePackage,
      basePriceUnit,
      discountPrice: decimal(get(row, "CENA_AR_ATLAIDI")),
      quantity,
      unit: unit as CspPriceRecord["unit"],
      retailer: owner,
      storeType: get(row, "VEIKALA_TIPS") || null,
      availability: get(row, "PIEEJAMIBA") || null,
      manufacturer: get(row, "RAZOTAJS") || null,
      manufacturerCountry: get(row, "RAZOTAJVALSTS") || null,
      url: sourceUrl(get(row, "URL"), owner),
      hierarchy: [1, 2, 3].map((level) => get(row, `HIERARHIJA_${level}LIMENIS_NOSAUKUMS`)).filter(Boolean),
      description: get(row, "APRAKSTS") || null
    };
    const key = `${record.date}|${record.retailer}|${record.gtin}`;
    const current = records.get(key);
    if (current && JSON.stringify(current) !== JSON.stringify(record)) {
      records.delete(key);
      duplicateConflicts.add(key);
      reject("conflicting_duplicate_price_row");
      continue;
    }
    if (!duplicateConflicts.has(key)) records.set(key, record);
  }

  const byGtin = new Map<string, CspPriceRecord[]>();
  for (const record of records.values()) byGtin.set(record.gtin, [...(byGtin.get(record.gtin) || []), record]);
  const identities: ExternalCatalogIdentity[] = [];
  const identityConflicts: string[] = [];
  for (const [gtin, candidates] of byGtin) {
    const latestDate = [...candidates].sort((left, right) => right.date.localeCompare(left.date))[0]!.date;
    const latest = candidates.filter((candidate) => candidate.date === latestDate);
    const manufacturers = [...new Set(latest.map((candidate) => candidate.manufacturer).filter((value): value is string => Boolean(value)))];
    const packs = [...new Set(latest.map((candidate) => `${candidate.quantity} ${candidate.unit}`))];
    if (manufacturers.length !== 1 || packs.length !== 1) {
      identityConflicts.push(gtin);
      continue;
    }
    const names = [...new Set(latest.map((candidate) => candidate.itemName))];
    const primary = [...latest].sort((left, right) => left.retailer.localeCompare(right.retailer))[0]!;
    identities.push({
      source: "csp_lv",
      sourceProductId: primary.sourceGtin,
      retailer: null,
      url: primary.url || CSP_SOURCE_URL,
      title: primary.itemName,
      aliases: names.filter((name) => name !== primary.itemName),
      brand: manufacturers[0]!,
      gtin,
      sku: null,
      category: primary.hierarchy.at(-1) || null,
      packSize: packs[0]!,
      imageUrl: null,
      price: null,
      currency: null,
      available: null,
      checkedAt: `${latestDate}T00:00:00.000Z`
    });
  }
  return {
    records: [...records.values()].sort((left, right) => `${left.date}|${left.retailer}|${left.gtin}`.localeCompare(`${right.date}|${right.retailer}|${right.gtin}`)),
    identities: identities.sort((left, right) => left.gtin!.localeCompare(right.gtin!)),
    rejected,
    identityConflicts: identityConflicts.sort(),
    delimiter
  };
}
