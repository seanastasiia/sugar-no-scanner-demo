import { PwaRegistration } from "@/components/pwa-registration";
import { ScannerApp } from "@/components/scanner-app";

// Scanner releases and environment flags must be read from the current deployment.
// A static root can remain cached at the edge after Railway swaps the container.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <PwaRegistration />
      <ScannerApp
        personalRankAvailable={process.env.PERSONAL_SHELF_RANK_ENABLED !== "false" && process.env.PERSONAL_SHELF_RANK_ENTRY_ENABLED !== "false"}
        paywallEnabled={process.env.WTP_PAYWALL_ENABLED === "true"}
      />
    </>
  );
}
