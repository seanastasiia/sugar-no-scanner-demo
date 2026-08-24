import { scoreReferenceProduct } from "@/lib/scoring";
import type { ProductRecord, ProductSource, RecognizedProductIdentity, ScoredProduct } from "@/lib/types";
import { normalizeRetailText } from "./barbora-catalog";

export interface NutritionLabelRead {
  basis: "100g" | "100ml" | "unknown";
  energyKcal: number;
  proteinG: number;
  totalSugarG: number;
  confidence: number;
  observedText: string;
}

function decimalPattern(value: number): string {
  const normalized = String(value).replace(".", "[.,]");
  return normalized.endsWith("[.,]0") ? normalized.slice(0, -5) + "(?:[.,]0)?" : normalized;
}

function labelHasValue(text: string, labels: string[], value: number): boolean {
  const normalized = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
  const number = decimalPattern(value);
  return labels.some((label) => {
    const normalizedLabel = normalizeRetailText(label);
    return new RegExp(`(?:${normalizedLabel}).{0,42}\\b${number}\\b|\\b${number}\\b.{0,42}(?:${normalizedLabel})`, "i").test(
      normalized
    );
  });
}

export function isTrustedNutritionLabelRead(read: NutritionLabelRead): boolean {
  if (read.confidence < 0.9 || read.basis === "unknown") return false;
  if (
    ![read.energyKcal, read.proteinG, read.totalSugarG].every((value) => Number.isFinite(value) && value >= 0) ||
    read.energyKcal > 1_000 ||
    read.proteinG > 100 ||
    read.totalSugarG > 100
  ) {
    return false;
  }
  const basisVisible = read.basis === "100ml" ? /100\s*ml/i.test(read.observedText) : /100\s*g/i.test(read.observedText);
  return (
    basisVisible &&
    labelHasValue(read.observedText, ["kcal"], read.energyKcal) &&
    labelHasValue(read.observedText, ["protein", "olbaltumvielas", "proteine"], read.proteinG) &&
    labelHasValue(read.observedText, ["sugars", "sugar", "cukuri", "dont sucres", "zucker"], read.totalSugarG)
  );
}

function productSlug(identity: RecognizedProductIdentity): string {
  return normalizeRetailText([identity.brand, identity.name, identity.variant, identity.packSize].filter(Boolean).join(" "))
    .replaceAll(" ", "-")
    .slice(0, 120);
}

function packAmount(identity: RecognizedProductIdentity): number {
  const match = identity.packSize?.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
  if (!match) return 0;
  const amount = Number.parseFloat(match[1].replace(",", "."));
  return ["kg", "l"].includes(match[2].toLowerCase()) ? amount * 1_000 : amount;
}

function sourceFields(record: ProductRecord): ProductSource["fields"] {
  const fields: ProductSource["fields"] = ["identity"];
  if (record.nutrientsPer100g.proteinG !== null) fields.push("protein");
  if (record.nutrientsPer100g.totalSugarG !== null) fields.push("totalSugar");
  return fields;
}

export function nutritionLabelToScoredProduct(
  identity: RecognizedProductIdentity,
  read: NutritionLabelRead,
  checkedAt = new Date().toISOString()
): ScoredProduct | null {
  if (!isTrustedNutritionLabelRead(read)) return null;
  const name = [identity.name, identity.variant].filter(Boolean).join(" · ");
  const record: ProductRecord = {
    id: `label:${productSlug(identity) || "scanned-product"}`,
    retailerProductId: "",
    brand: identity.brand || "Scanned product",
    name,
    shortName: name,
    aliases: [],
    format: "other",
    category: identity.category || null,
    packSizeG: packAmount(identity),
    nutritionBasis: read.basis === "100ml" ? "100ml" : "100g",
    energyKcalPer100: read.energyKcal,
    gtin: null,
    nutrientsPer100g: {
      proteinG: read.proteinG,
      fiberG: null,
      totalSugarG: read.totalSugarG
    },
    noAddedSugarClaim: false,
    imageUrl: null,
    retailerUrl: "",
    sources: [],
    isGolden: false,
    accent: "coral"
  };
  record.sources = [
    {
      label: "Nutrition label in this scan",
      url: "",
      checkedAt,
      fields: sourceFields(record),
      status: "verified"
    }
  ];
  return scoreReferenceProduct(record, "package_label_reference", "package_label_reference_partial");
}
