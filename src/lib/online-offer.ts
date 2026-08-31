import type { RetailerOffer, ScoredProduct, ShelfPrice } from "./types";

const BARBORA_PRODUCT_PREFIX = "https://barbora.lv/produkti/";

export function barboraProductSlug(retailerUrl: string): string | null {
  if (!retailerUrl.startsWith(BARBORA_PRODUCT_PREFIX)) return null;
  const slug = retailerUrl.slice(BARBORA_PRODUCT_PREFIX.length).split(/[?#]/, 1)[0];
  return /^[a-z0-9-]+$/.test(slug) ? slug : null;
}

export function retailerOfferKey(
  product: Pick<ScoredProduct, "id" | "retailerUrl">
): string | null {
  const barboraSlug = barboraProductSlug(product.retailerUrl);
  if (barboraSlug) return `barbora:${barboraSlug}`;
  return /^(rimi_lv|livin_lv):[A-Za-z0-9._~-]+$/.test(product.id) ? product.id : null;
}

export function isExactOnlineSaving(
  offer: RetailerOffer | null | undefined,
  shelfPrice: ShelfPrice | null | undefined
): boolean {
  return Boolean(offer?.exactSku && shelfPrice && offer.price < shelfPrice.amount);
}
