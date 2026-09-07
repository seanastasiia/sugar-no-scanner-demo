import snapshot from "../../data/shelf-demo-evidence.generated.json";
import { normalizeIngredientText, type ShelfEvidence } from "./personal-shelf-rank";
import { SHELF_DEMO_PRODUCTS } from "./shelf-demo-products";
import type { ProductRecord } from "./types";
import { productDisplayName } from "./product-display";

type DemoObservation = { title: string; evidence: ShelfEvidence };

/** Canonicalize only the pilot's copy. Original Fit, IDs, offers and overlays stay untouched. */
export function shelfDemoPersonalProduct(product: ProductRecord, observations = snapshot as DemoObservation[]): ProductRecord {
  const spec = SHELF_DEMO_PRODUCTS.find((entry) => entry.id === product.id);
  if (!spec || product.brand.toUpperCase() !== spec.brand || product.packSizeG !== 55) return product;
  const sourceUrl = `https://barbora.lv/produkti/${spec.id}`;
  const entry = observations.find((row) => row.evidence.productId === `barbora:${spec.id}`);
  if (!entry || product.retailerUrl !== sourceUrl || entry.evidence.sourceUrl !== sourceUrl || entry.evidence.source !== "barbora_lv") return product;
  if (product.gtin && entry.evidence.gtin && product.gtin !== entry.evidence.gtin) return product;
  const title = normalizeIngredientText(entry.title);
  if (!title.includes(spec.brand.toLowerCase()) || !/\bbatonins\b/.test(title) || !/\b55\s*g\b/.test(title)) return product;
  return { ...product, id: entry.evidence.productId, shortName: productDisplayName(product), format: "bar", shelfEvidence: entry.evidence };
}
