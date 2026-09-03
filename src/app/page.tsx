import { PwaRegistration } from "@/components/pwa-registration";
import { ScannerApp } from "@/components/scanner-app";

export default function HomePage() {
  return (
    <>
      <PwaRegistration />
      <ScannerApp personalRankAvailable={process.env.PERSONAL_SHELF_RANK_ENABLED !== "false"} />
    </>
  );
}
