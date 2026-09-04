import { NextResponse } from "next/server";
import foodProductIndex from "../../../../data/barbora-food-product-index.generated.json";
import nutritionIndex from "../../../../data/barbora-nutrition-index.generated.json";
import { investorCategoryForRetailPath } from "@/lib/supported-categories";
import type { BarboraNutritionIndexProduct } from "@/server/barbora-nutrition-index";
import { externalCatalogCounts, externalCatalogIdentityCount } from "@/server/external-catalog";
import { openFoodFactsBulkCount } from "@/server/open-food-facts";
import { shelfEvidenceCounts } from "@/server/personal-shelf-evidence";

export const dynamic = "force-dynamic";

export function GET() {
  const retailerCatalogs = externalCatalogCounts();
  const investorPack = (nutritionIndex as BarboraNutritionIndexProduct[]).reduce(
    (counts, product) => {
      const category = investorCategoryForRetailPath(product.category);
      if (category) counts[category] += 1;
      return counts;
    },
    { snacks: 0, dairy_desserts: 0 }
  );
  return NextResponse.json(
    {
      status: "ok",
      service: "sugar-no-scanner-demo",
      commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.COMMIT_SHA || "local",
      features: { sharedWebCatalog: process.env.SHARED_WEB_CATALOG_ENABLED === "true",
        sharedWebShelfEvidence: process.env.SHARED_WEB_CATALOG_ENABLED === "true" && process.env.SHARED_WEB_SHELF_EVIDENCE_ENABLED === "true",
        personalShelfRank: process.env.PERSONAL_SHELF_RANK_ENABLED !== "false" },
      catalog: {
        activeFoodProducts: foodProductIndex.length,
        productsWithAutomaticFit: nutritionIndex.length,
        connectedRetailerProducts: retailerCatalogs,
        livinnFoodIdentities: externalCatalogIdentityCount(),
        openFoodFactsBulkProducts: openFoodFactsBulkCount(),
        personalShelf: shelfEvidenceCounts(),
        investorPack: {
          ...investorPack,
          total: investorPack.snacks + investorPack.dairy_desserts,
          nutritionSignals: ["protein", "totalSugar"]
        }
      },
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        "cache-control": "no-store"
      }
    }
  );
}
