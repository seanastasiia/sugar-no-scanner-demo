import { MetaConsent } from "@/components/meta-consent";
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
      {process.env.META_PIXEL_ID && /^\d{5,25}$/.test(process.env.META_PIXEL_ID) ? <MetaConsent pixelId={process.env.META_PIXEL_ID} /> : null}
    </>
  );
}
