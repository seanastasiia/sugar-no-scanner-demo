import { notFound } from "next/navigation";
import { ShelfQueuePage } from "@/components/shelf-queue";
export const dynamic = "force-dynamic";
export default function QueuePage() {
  if (process.env.SHELF_RESEARCH_QUEUE_ENABLED !== "true") notFound();
  return <ShelfQueuePage />;
}
