import { getCatalog, getProductWithAlternatives } from "@/lib/catalog";
import { scoreCatalog } from "@/lib/scoring";
import type { ProductRecord, ScoredProduct } from "@/lib/types";
import { getRatedBarboraProduct } from "./barbora-product-rating";
import { getIndexedBarboraProductWithAlternatives } from "./barbora-nutrition-index";
import { getOpenFoodFactsProductByBarcode } from "./open-food-facts";
import { getSupabaseAdmin } from "./supabase";

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
      totalSugarG: row.total_sugar_g_100
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
  if (error) throw new Error(`Catalog query failed: ${error.message}`);
  const products = scoreCatalog((data as ProductRow[]).map(rowToProduct));
  catalogCache = { products, expiresAt: Date.now() + CATALOG_CACHE_TTL_MS };
  return products;
}

export async function productWithAlternatives(id: string) {
  if (id.startsWith("off:")) {
    try {
      const product = await getOpenFoodFactsProductByBarcode(id.slice("off:".length));
      return product ? { product, alternatives: [] } : null;
    } catch {
      return null;
    }
  }
  if (id.startsWith("barbora:")) {
    try {
      const indexed = getIndexedBarboraProductWithAlternatives(id.slice("barbora:".length));
      if (indexed) return indexed;
      const product = await getRatedBarboraProduct(id.slice("barbora:".length));
      return product ? { product, alternatives: [] } : null;
    } catch {
      return null;
    }
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return getProductWithAlternatives(id);
  const products = await listProducts();
  const product = products.find((candidate) => candidate.id === id);
  if (!product) return null;
  const { rankSimilarProducts } = await import("@/lib/scoring");
  return { product, alternatives: rankSimilarProducts(product, products) };
}
