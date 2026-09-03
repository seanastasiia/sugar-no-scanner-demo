import type { ProductRecord } from "./types";

// Exact demo SKUs approved in Pen. This is presentation only: source names,
// identity matching, nutrition, offers and analytics retain their original data.
const demoPresentation: Record<string, { name: string; image: string }> = {
  "prot-bat-sal-riekst-saldin-barebells-55-g": { name: "Salty Peanut", image: "/demo-products/salty-peanut.png" },
  "proteina-bat-cepuma-garsa-iconfit-55-g": { name: "Cookie Bliss", image: "/demo-products/cookie-bliss.png" },
  "proteina-baton-barebells-coco-choco-55-g": { name: "Coco Choco", image: "/demo-products/coco-choco.png" },
  "prot-bat-barebells-lemon-cheesecake-55-g": { name: "Lemon Cheesecake", image: "/demo-products/lemon-cheesecake.png" }
};

export function productDisplayName(product: Pick<ProductRecord, "id" | "shortName">) {
  return demoPresentation[product.id]?.name || product.shortName;
}

export function productDisplayImage(product: Pick<ProductRecord, "id" | "imageUrl">) {
  return demoPresentation[product.id]?.image || product.imageUrl;
}
