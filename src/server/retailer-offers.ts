import type { RetailerOffer } from "@/lib/types";
import { getKnownBarboraOfferBySlug } from "./barbora-catalog";
import { getExternalCatalogOfferByKey } from "./external-catalog";

export async function getKnownRetailerOfferByKey(key: string): Promise<RetailerOffer | null> {
  if (key.startsWith("barbora:")) {
    return getKnownBarboraOfferBySlug(key.slice("barbora:".length));
  }
  if (key.startsWith("rimi_lv:") || key.startsWith("livin_lv:")) {
    return getExternalCatalogOfferByKey(key);
  }
  return null;
}
