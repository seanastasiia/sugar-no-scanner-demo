import type { Metadata } from "next";
export const metadata: Metadata = { title: "Personal Shelf | Sugar.no", manifest: "/pilot/shelf/manifest.webmanifest", appleWebApp: { capable: true, title: "Personal Shelf", statusBarStyle: "black-translucent" }, referrer: "no-referrer" };
export default function ShelfLayout({ children }: { children: React.ReactNode }) { return children; }
