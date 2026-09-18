import { cookies } from "next/headers";
import { OWNER_COOKIE, verifyOwnerToken } from "@/server/shelf-owner";
import { notFound } from "next/navigation";
import { ScannerApp } from "@/components/scanner-app";
export const dynamic = "force-dynamic";
export default async function ShelfPilotPage() {
  if (process.env.SHELF_RESEARCH_QUEUE_ENABLED !== "true") notFound();
  const ownerAccess = verifyOwnerToken((await cookies()).get(OWNER_COOKIE)?.value, "session");
  return <ScannerApp ownerAccess={ownerAccess} personalRankAvailable shelfResearchEnabled paywallEnabled={!ownerAccess && process.env.WTP_PAYWALL_ENABLED === "true"} />;
}
