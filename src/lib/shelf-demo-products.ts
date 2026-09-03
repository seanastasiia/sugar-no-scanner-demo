/** Exact existing Shelf photo SKUs. This is not a fuzzy cross-retailer mapping. */
export const SHELF_DEMO_PRODUCTS = [
  { id: "prot-bat-sal-riekst-saldin-barebells-55-g", brand: "BAREBELLS" },
  { id: "prot-bat-barebells-lemon-cheesecake-55-g", brand: "BAREBELLS" },
  { id: "proteina-bat-cepuma-garsa-iconfit-55-g", brand: "ICONFIT" },
  { id: "proteina-baton-barebells-coco-choco-55-g", brand: "BAREBELLS" }
] as const;

export function shelfDemoOriginalId(id: string): string {
  return SHELF_DEMO_PRODUCTS.find((product) => `barbora:${product.id}` === id)?.id || id;
}
