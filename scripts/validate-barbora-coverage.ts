import foodSlugs from "../data/barbora-food-product-index.generated.json";
import nutritionProducts from "../data/barbora-nutrition-index.generated.json";
import type { BarboraNutritionIndexProduct } from "../src/server/barbora-nutrition-index";

const products = nutritionProducts as BarboraNutritionIndexProduct[];
const uniqueSlugs = new Set(products.map((product) => product.slug));
const activeFoodSlugs = new Set(foodSlugs as string[]);
const invalid = products.filter(
  (product) =>
    !product.slug ||
    !product.title ||
    !product.brand ||
    !Number.isFinite(product.energyKcal) ||
    product.energyKcal <= 0 ||
    !Number.isFinite(product.proteinG) ||
    product.proteinG < 0 ||
    !Number.isFinite(product.totalSugarG) ||
    product.totalSugarG < 0 ||
    product.isAdult
);
const categories = new Set(products.map((product) => product.category).filter(Boolean));
const brands = new Set(products.map((product) => product.brand).filter(Boolean));
const coverage = foodSlugs.length ? products.length / foodSlugs.length : 0;
const staleProducts = products.filter((product) => !activeFoodSlugs.has(product.slug));

const report = {
  activeFoodProducts: foodSlugs.length,
  productsWithAutomaticFit: products.length,
  automaticFitCoverage: Number(coverage.toFixed(4)),
  brands: brands.size,
  categories: categories.size,
  duplicateSlugs: products.length - uniqueSlugs.size,
  invalidProducts: invalid.length,
  staleProducts: staleProducts.length
};

console.log(JSON.stringify(report, null, 2));

if (foodSlugs.length < 8_000) throw new Error(`Expected broad Latvia food index, received ${foodSlugs.length}`);
if (products.length < 6_000) throw new Error(`Expected at least 6,000 products with automatic fit, received ${products.length}`);
if (coverage < 0.6) throw new Error(`Automatic fit coverage ${(coverage * 100).toFixed(1)}% is below 60%`);
if (uniqueSlugs.size !== products.length) throw new Error("Duplicate Barbora nutrition slugs found");
if (invalid.length) throw new Error(`${invalid.length} invalid or adult products found in nutrition index`);
if (staleProducts.length) throw new Error(`${staleProducts.length} nutrition products are outside the active food index`);
