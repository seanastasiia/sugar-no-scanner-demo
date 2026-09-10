import { notFound } from "next/navigation";
import { ScannerApp } from "@/components/scanner-app";
export const dynamic = "force-dynamic";
export default function ShelfPilotPage() {
  if (process.env.SHELF_RESEARCH_QUEUE_ENABLED !== "true") notFound();
  return <ScannerApp personalRankAvailable shelfResearchEnabled paywallEnabled={process.env.WTP_PAYWALL_ENABLED === "true"} />;
}
