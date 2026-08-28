import { writeFile } from "node:fs/promises";
import type { CatalogSourceManifest } from "../src/server/external-catalog-types";

const manifests: CatalogSourceManifest[] = [
  {
    id: "rimi_lv",
    displayName: "Rimi Latvia e-store",
    layer: "retailer_snapshot",
    license: "Retailer public product-page snapshot; production reuse requires retailer permission",
    attribution: "Product identity, nutrition, availability and price from Rimi Latvia product pages",
    termsUrl: "https://www.rimi.lv/e-veikals/lv/lietosanas-noteikumi",
    dataUrl: "https://www.rimi.lv/e-veikals/sitemap.xml",
    redistributable: false
  },
  {
    id: "livin_lv",
    displayName: "LIVIN Latvia",
    layer: "retailer_snapshot",
    license: "Retailer public product-page snapshot; production reuse requires retailer permission",
    attribution: "Product identity, nutrition, availability and price from LIVIN Latvia product pages",
    termsUrl: "https://www.livin.lv/page/pirksanas-noteikumi",
    dataUrl: "https://www.livin.lv/sitemap/products.xml",
    redistributable: false
  },
  {
    id: "open_food_facts",
    displayName: "Open Food Facts",
    layer: "odbl_bulk",
    license: "Open Database License 1.0; individual contents under Database Contents License; product images under CC BY-SA",
    attribution: "Open Food Facts contributors; retain image attribution under CC BY-SA",
    termsUrl: "https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/",
    dataUrl: "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz",
    redistributable: true
  }
];

await writeFile("data/catalog-sources.generated.json", `${JSON.stringify(manifests, null, 2)}\n`, "utf8");
console.log(`Wrote ${manifests.length} catalog source manifests.`);
