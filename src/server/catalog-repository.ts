import { getCatalog, getProductWithAlternatives } from "@/lib/catalog";
import { rankSimilarProducts, scoreCatalog } from "@/lib/scoring";
import type { ProductRecord, ScoredProduct } from "@/lib/types";
import { getRatedBarboraProduct } from "./barbora-product-rating";
import { getIndexedBarboraNutrition, indexedBarboraProductToScoredProduct, listIndexedBarboraScoredProducts } from "./barbora-nutrition-index";
import { getExternalCatalogProductById, listExternalCatalogScoredProducts } from "./external-catalog";
import { getOpenFoodFactsProductByBarcode, listOpenFoodFactsBulkProducts } from "./open-food-facts";
import { getSupabaseAdmin } from "./supabase";
import { getSharedWebProduct } from "./shared-web-catalog";

interface ProductRow {
  id: string;
  retailer_product_id: string;
  brand: string;
  name: string;
  short_name: string;
  aliases: string[];
  format: ProductRecord["format"];
  pack_size_g: number;
  gtin: string | null;
  protein_g_100: number | null;
  fiber_g_100: number | null;
  total_sugar_g_100: number | null;
  carbohydrate_g_100: number | null;
  no_added_sugar_claim: boolean;
  image_url: string | null;
  retailer_url: string;
  is_golden: boolean;
  accent: string;
  product_sources?: Array<{
    label: string;
    url: string;
    checked_at: string;
    fields: ProductRecord["sources"][number]["fields"];
    status: ProductRecord["sources"][number]["status"];
  }>;
}

const CATALOG_CACHE_TTL_MS = 60_000;
let catalogCache: { expiresAt: number; products: ScoredProduct[] } | null = null;
let alternativePoolCache: { expiresAt: number; products: ScoredProduct[] } | null = null;

function rowToProduct(row: ProductRow): ProductRecord {
  return {
    id: row.id,
    retailerProductId: row.retailer_product_id,
    brand: row.brand,
    name: row.name,
    shortName: row.short_name,
    aliases: row.aliases || [],
    format: row.format,
    packSizeG: row.pack_size_g,
    gtin: row.gtin,
    nutrientsPer100g: {
      proteinG: row.protein_g_100,
      fiberG: row.fiber_g_100,
      totalSugarG: row.total_sugar_g_100,
      carbohydrateG: row.carbohydrate_g_100 ?? null
    },
    noAddedSugarClaim: row.no_added_sugar_claim,
    imageUrl: row.image_url,
    retailerUrl: row.retailer_url,
    isGolden: row.is_golden,
    accent: row.accent,
    sources: (row.product_sources || []).map((source) => ({
      label: source.label,
      url: source.url,
      checkedAt: source.checked_at,
      fields: source.fields,
      status: source.status
    }))
  };
}

export async function listProducts(): Promise<ScoredProduct[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return getCatalog();
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.products;
  const { data, error } = await supabase.from("products").select("*, product_sources(*)").order("name");
  if (error || !data?.length) {
    console.info(
      "catalog_supabase_fallback",
      JSON.stringify({ reason: error?.message || "empty_products_table" })
    );
    return getCatalog();
  }
  const products = scoreCatalog((data as ProductRow[]).map(rowToProduct));
  catalogCache = { products, expiresAt: Date.now() + CATALOG_CACHE_TTL_MS };
  return products;
}

function dedupeProducts(products: ScoredProduct[]): ScoredProduct[] {
  const deduped = new Map<string, ScoredProduct>();
  for (const product of products) {
    const key = product.gtin ? `gtin:${product.gtin}` : product.id;
    const current = deduped.get(key);
    if (!current || (!current.imageUrl && product.imageUrl)) deduped.set(key, product);
  }
  return [...deduped.values()];
}

async function listVerifiedAlternativePool(): Promise<ScoredProduct[]> {
  if (alternativePoolCache && alternativePoolCache.expiresAt > Date.now()) {
    return alternativePoolCache.products;
  }
  const products = dedupeProducts([
    ...(await listProducts()),
    ...listIndexedBarboraScoredProducts(),
    ...listExternalCatalogScoredProducts(),
    ...listOpenFoodFactsBulkProducts()
  ]).filter((product) => product.matchScore !== null && product.ratingStatus === "complete");
  alternativePoolCache = { products, expiresAt: Date.now() + CATALOG_CACHE_TTL_MS };
  return products;
}

async function resolveProduct(id: string): Promise<ScoredProduct | null> {
  if (id.startsWith("web:shared:")) return getSharedWebProduct(id);
  if (id.startsWith("off:")) {
    return getOpenFoodFactsProductByBarcode(id.slice("off:".length));
  }
  if (id.startsWith("barbora:")) {
    const slug = id.slice("barbora:".length);
    const indexed = getIndexedBarboraNutrition(slug);
    return indexed ? indexedBarboraProductToScoredProduct(indexed) : getRatedBarboraProduct(slug);
  }
  if (id.startsWith("rimi_lv:") || id.startsWith("livin_lv:") || id.startsWith("livinn_lt:")) {
    return getExternalCatalogProductById(id);
  }
  return (await listProducts()).find((candidate) => candidate.id === id) || null;
}

export async function productWithAlternatives(id: string) {
  try {
    const product = await resolveProduct(id);
    if (!product) return null;
    return {
      product,
      alternatives: rankSimilarProducts(product, await listVerifiedAlternativePool(), 24)
    };
  } catch {
    if (!id.includes(":")) return getProductWithAlternatives(id);
    return null;
  }
}
