export type ExternalCatalogSource = "barbora_lv" | "rimi_lv" | "lidl_lv" | "livin_lv" | "livinn_lt" | "open_food_facts" | "csp_lv";

export interface ExternalCatalogProduct {
  shelfEvidence?: import("@/lib/personal-shelf-rank").ShelfEvidence | null;
  source: ExternalCatalogSource;
  sourceProductId: string;
  retailer: "Barbora" | "Rimi" | "Lidl" | "Livin" | null;
  url: string;
  title: string;
  aliases?: string[];
  brand: string;
  gtin: string | null;
  sku: string | null;
  category: string | null;
  packSize: string;
  nutritionBasis: "100g" | "100ml";
  energyKcal: number;
  proteinG: number;
  totalSugarG: number;
  carbohydrateG?: number | null;
  imageUrl: string | null;
  price: number | null;
  currency: "EUR" | null;
  available: boolean | null;
  checkedAt: string;
}

export interface ExternalCatalogIdentity {
  source: "rimi_lv" | "lidl_lv" | "livinn_lt" | "open_food_facts" | "csp_lv";
  sourceProductId: string;
  retailer: "Rimi" | "Lidl" | "Livin" | null;
  url: string;
  title: string;
  aliases: string[];
  brand: string;
  gtin: string | null;
  sku: string | null;
  category: string | null;
  packSize: string;
  imageUrl: string | null;
  price: number | null;
  currency: "EUR" | null;
  available: boolean | null;
  checkedAt: string;
}

export interface CatalogSourceManifest {
  id: ExternalCatalogSource;
  displayName: string;
  layer: "retailer_snapshot" | "odbl_bulk" | "government_price_feed";
  license: string;
  attribution: string;
  termsUrl: string;
  dataUrl: string;
  redistributable: boolean;
}
