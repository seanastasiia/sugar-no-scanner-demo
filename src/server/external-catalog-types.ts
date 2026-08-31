export type ExternalCatalogSource = "barbora_lv" | "rimi_lv" | "livin_lv" | "open_food_facts";

export interface ExternalCatalogProduct {
  source: ExternalCatalogSource;
  sourceProductId: string;
  retailer: "Barbora" | "Rimi" | "Livin" | null;
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

export interface CatalogSourceManifest {
  id: ExternalCatalogSource;
  displayName: string;
  layer: "retailer_snapshot" | "odbl_bulk";
  license: string;
  attribution: string;
  termsUrl: string;
  dataUrl: string;
  redistributable: boolean;
}
