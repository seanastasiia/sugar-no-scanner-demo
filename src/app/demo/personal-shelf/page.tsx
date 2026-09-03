import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PersonalShelfDemo } from "@/components/personal-shelf-demo";
import { personalShelfDemoProducts } from "@/server/personal-shelf-demo";

export const metadata: Metadata = {
  title: "New rating demo | Sugar.no",
  robots: { index: false, follow: false }
};

export default function PersonalShelfDemoPage() {
  if (process.env.PERSONAL_SHELF_RANK_ENABLED === "false") notFound();
  return <PersonalShelfDemo products={personalShelfDemoProducts()} />;
}
