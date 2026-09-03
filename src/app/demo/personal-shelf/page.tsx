import type { Metadata } from "next";
import { PersonalShelfDemo } from "@/components/personal-shelf-demo";
import { personalShelfDemoProducts } from "@/server/personal-shelf-demo";

export const metadata: Metadata = {
  title: "New rating demo | Sugar.no",
  robots: { index: false, follow: false }
};

export default function PersonalShelfDemoPage() {
  return <PersonalShelfDemo products={personalShelfDemoProducts()} />;
}
