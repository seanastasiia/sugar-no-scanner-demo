import { createHash } from "node:crypto";
import type { BarboraNutritionIndexProduct } from "./barbora-nutrition-index";
import { nutritionRevalidateAfter } from "./data-freshness";

const SOURCE_ID = "barbora_lv" as const;
export const BARBORA_RATED_PRODUCT_COUNT = 7_433;

export interface BarboraManagedProductRow {
  source_id: typeof SOURCE_ID;
  source_product_id: string;
  retailer: "Barbora";
  url: string;
  title: string;
  brand: string;
  gtin: null;
  sku: string;
  category: string | null;
  pack_size: string;
  nutrition_basis: "100g" | "100ml";
  energy_kcal_100: number;
  protein_g_100: number;
  total_sugar_g_100: number;
  carbohydrate_g_100: number | null;
  image_url: string | null;
  price: null;
  currency: null;
  available: true;
  checked_at: string;
  nutrition_source_kind: "retailer";
  nutrition_verified_at: string;
  nutrition_revalidate_after: string;
  price_verified_at: null;
  price_revalidate_after: null;
  snapshot_checked_at: string;
}

export interface BarboraCatalogSnapshot {
  productRows: BarboraManagedProductRow[];
  versionRows: Array<{
    source_id: typeof SOURCE_ID;
    source_product_id: string;
    version_hash: string;
    nutrition_source_kind: "retailer";
    source_url: string;
    title: string;
    nutrition_basis: "100g" | "100ml";
    energy_kcal_100: number;
    protein_g_100: number;
    total_sugar_g_100: number;
    carbohydrate_g_100: number | null;
    image_url: string | null;
    verified_at: string;
    revalidate_after: string;
  }>;
  summary: {
    sourceId: typeof SOURCE_ID;
    registryCount: number;
    completeNutritionCount: number;
    pricedCount: 0;
    snapshotChecksum: string;
  };
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicate product slugs`);
}

function exactBarboraUrl(slug: string): string {
  return `https://barbora.lv/produkti/${slug}`;
}

export function buildBarboraCatalogSnapshot(input: {
  nutritionProducts: BarboraNutritionIndexProduct[];
  snapshotCheckedAt: string;
}): BarboraCatalogSnapshot {
  assertUnique(input.nutritionProducts.map((product) => product.slug), "Barbora nutrition index");
  if (input.nutritionProducts.length !== BARBORA_RATED_PRODUCT_COUNT) {
    throw new Error(
      `Barbora rated catalog must contain exactly ${BARBORA_RATED_PRODUCT_COUNT} exact SKUs; received ${input.nutritionProducts.length}`
    );
  }

  const productRows = [...input.nutritionProducts]
    .sort((left, right) => left.slug.localeCompare(right.slug))
    .map((product) => ({
      source_id: SOURCE_ID,
      source_product_id: product.slug,
      retailer: "Barbora" as const,
      url: exactBarboraUrl(product.slug),
      title: product.title,
      brand: product.brand,
      gtin: null,
      sku: product.slug,
      category: product.category,
      pack_size: product.packSize,
      nutrition_basis: product.nutritionBasis,
      energy_kcal_100: product.energyKcal,
      protein_g_100: product.proteinG,
      total_sugar_g_100: product.totalSugarG,
      carbohydrate_g_100: product.carbohydrateG ?? null,
      image_url: product.imageUrl,
      price: null,
      currency: null,
      available: true as const,
      checked_at: product.checkedAt,
      nutrition_source_kind: "retailer" as const,
      nutrition_verified_at: product.checkedAt,
      nutrition_revalidate_after: nutritionRevalidateAfter(product.checkedAt, "retailer"),
      price_verified_at: null,
      price_revalidate_after: null,
      snapshot_checked_at: input.snapshotCheckedAt
    }));

  const snapshotChecksum = createHash("sha256")
    .update(JSON.stringify({
      nutrition: productRows.map((row) => [
        row.source_product_id,
        row.protein_g_100,
        row.total_sugar_g_100,
        row.carbohydrate_g_100,
        row.nutrition_verified_at
      ])
    }))
    .digest("hex");

  const versionRows = productRows.map((row) => ({
    source_id: row.source_id,
    source_product_id: row.source_product_id,
    version_hash: createHash("sha256")
      .update(JSON.stringify([
        row.nutrition_basis,
        row.energy_kcal_100,
        row.protein_g_100,
        row.total_sugar_g_100,
        row.carbohydrate_g_100,
        row.nutrition_verified_at
      ]))
      .digest("hex"),
    nutrition_source_kind: row.nutrition_source_kind,
    source_url: row.url,
    title: row.title,
    nutrition_basis: row.nutrition_basis,
    energy_kcal_100: row.energy_kcal_100,
    protein_g_100: row.protein_g_100,
    total_sugar_g_100: row.total_sugar_g_100,
    carbohydrate_g_100: row.carbohydrate_g_100,
    image_url: row.image_url,
    verified_at: row.nutrition_verified_at,
    revalidate_after: row.nutrition_revalidate_after
  }));

  return {
    productRows,
    versionRows,
    summary: {
      sourceId: SOURCE_ID,
      registryCount: productRows.length,
      completeNutritionCount: productRows.length,
      pricedCount: 0,
      snapshotChecksum
    }
  };
}
