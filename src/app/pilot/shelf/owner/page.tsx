import { notFound } from "next/navigation";
import { ShelfOwnerLogin } from "@/components/shelf-owner-login";
export const dynamic = "force-dynamic";
export default function OwnerPage() {
  if (process.env.SHELF_RESEARCH_QUEUE_ENABLED !== "true") notFound();
  return <ShelfOwnerLogin />;
}
