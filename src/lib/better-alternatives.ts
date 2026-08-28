import { overallMatchPresentation } from "./match-presentation";
import type { ProductFormat, RetailerOffer, ScoredProduct } from "./types";

type InterchangeableProduct = Pick<
  ScoredProduct,
  "category" | "format" | "name" | "nutritionBasis"
>;

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleType(title: string, leafCategory: string): string | null {
  const normalizedTitle = normalize(title);
  const normalizedLeaf = normalize(leafCategory);

  if (
    /(protein|proteina|proteinu)/.test(normalizedTitle) &&
    /(baton|bar)/.test(normalizedTitle)
  ) return "protein-bar";
  if (/(biezpiena sierin|curd snack)/.test(normalizedTitle)) return "curd-snack";
  if (/(dzeramais jogurt|drinking yogurt)/.test(normalizedTitle)) return "drinking-yogurt";
  if (/(jogurt|yogurt|yoghurt)/.test(normalizedTitle)) return "yogurt";
  if (/(baton|snack bar)/.test(normalizedTitle)) return "snack-bar";
  if (/(granola)/.test(normalizedTitle)) return "granola";
  if (/(musli|muesli)/.test(normalizedTitle)) return "muesli";
  if (/(pudin|pudding)/.test(normalizedTitle)) return "pudding";

  if (normalizedLeaf === "sinepes") return "mustard";
  if (normalizedLeaf === "kecupi") return "ketchup";
  if (normalizedLeaf === "majoneze") return "mayonnaise";
  if (normalizedLeaf === "majonezes merces") return "mayonnaise-sauce";
  return null;
}

const broadLeafCategories = new Set([
  "citas uzkodas",
  "produkti bez glutena",
  "speciala partika",
  "veseligie naski"
]);

/**
 * Returns a fail-closed key for products that can reasonably replace one
 * another. Barbora's full leaf taxonomy supplies the subcategory/form, while
 * title discriminators keep protein bars, yogurts and sauces from leaking into
 * wider retailer buckets.
 */
export function interchangeabilityKey(product: InterchangeableProduct): string | null {
  const fullCategory = normalize(product.category || "");
  const leafCategory = product.category?.split("/").at(-1)?.trim() || "";
  const explicitType = titleType(product.name, leafCategory);
  const basis = product.nutritionBasis || "100g";

  if (fullCategory) {
    const normalizedLeaf = normalize(leafCategory);
    if (!explicitType && broadLeafCategories.has(normalizedLeaf)) return null;
    return [fullCategory, explicitType || normalizedLeaf, basis].join("|");
  }

  if (explicitType) return [explicitType, basis].join("|");
  const format: ProductFormat = product.format;
  return format === "other" ? null : [format, basis].join("|");
}

export function areInterchangeable(current: InterchangeableProduct, candidate: InterchangeableProduct): boolean {
  const currentKey = interchangeabilityKey(current);
  return Boolean(currentKey && currentKey === interchangeabilityKey(candidate));
}

export function hasGreatFit(product: Pick<ScoredProduct, "matchScore">): boolean {
  return overallMatchPresentation(product.matchScore).tone === "strong";
}

/**
 * The UI only exposes alternatives whose exact Barbora offer resolved now.
 * Every alternative must be a Great fit and no worse than the current item.
 * Equal-fit products are ordered by lower current price and then the closest
 * pack size, keeping commercial data out of the fit itself.
 */
export function rankAvailableBetterAlternatives(
  current: ScoredProduct,
  alternatives: ScoredProduct[],
  offers: Record<string, RetailerOffer | null>,
  slugForProduct: (product: ScoredProduct) => string | null,
  limit = 4
): ScoredProduct[] {
  if (current.matchScore === null) return [];
  const currentMatchScore = current.matchScore;
  return alternatives
    .filter((candidate) => {
      const slug = slugForProduct(candidate);
      const offer = slug ? offers[slug] : null;
      return Boolean(
        slug &&
        offer?.exactSku &&
        candidate.matchScore !== null &&
        hasGreatFit(candidate) &&
        candidate.matchScore >= currentMatchScore &&
        areInterchangeable(current, candidate)
      );
    })
    .sort((left, right) => {
      const scoreDifference = (right.matchScore ?? -1) - (left.matchScore ?? -1);
      if (scoreDifference) return scoreDifference;
      const leftSlug = slugForProduct(left)!;
      const rightSlug = slugForProduct(right)!;
      const priceDifference = offers[leftSlug]!.price - offers[rightSlug]!.price;
      if (priceDifference) return priceDifference;
      const leftPackDistance = Math.abs(left.packSizeG - current.packSizeG);
      const rightPackDistance = Math.abs(right.packSizeG - current.packSizeG);
      return leftPackDistance - rightPackDistance || left.name.localeCompare(right.name);
    })
    .slice(0, limit);
}
