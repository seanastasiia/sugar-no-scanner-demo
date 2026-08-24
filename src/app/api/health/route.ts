import { NextResponse } from "next/server";
import foodProductIndex from "../../../../data/barbora-food-product-index.generated.json";
import nutritionIndex from "../../../../data/barbora-nutrition-index.generated.json";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "sugar-no-scanner-demo",
      commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.COMMIT_SHA || "local",
      catalog: {
        activeFoodProducts: foodProductIndex.length,
        productsWithAutomaticFit: nutritionIndex.length
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
