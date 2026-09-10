import { z } from "zod";
import type { ProductRecord } from "./types";

export function validQueueBarcode(value: string): boolean {
  if (!/^(?:\d{8}|\d{12,14})$/.test(value) || /^0+$/.test(value)) return false;
  const digits = [...value].map(Number); const check = digits.pop();
  return (10 - digits.reverse().reduce((sum, n, i) => sum + n * (i % 2 ? 1 : 3), 0) % 10) % 10 === check;
}
export const queueLookupSchema = z.object({
  productId: z.string().max(240).regex(/^(?:[a-zA-Z0-9._~:-]+)$/).optional(),
  brand: z.string().trim().max(80).default(""),
  name: z.string().trim().max(180).default(""),
  variant: z.string().trim().max(120).default(""),
  packSize: z.string().trim().max(60).default(""),
  barcode: z.string().refine(validQueueBarcode, "Check the barcode digits").optional(),
  sourceUrl: z.string().url().max(1500).optional()
}).strict().refine(value => Boolean(value.productId || value.barcode || (value.brand && value.name)), "Add a barcode or brand and product name");
export type QueueLookup = z.infer<typeof queueLookupSchema>;
export type QueueStatus = "queued" | "searching" | "ready" | "needs_info" | "review" | "retry" | "failed";
export interface ShelfQueueItem {
  id: string;
  lookup: QueueLookup;
  status: QueueStatus;
  reason: string;
  missing: string[];
  result: ProductRecord | null;
  updatedAt: string;
}
export const QUEUE_OWNER_KEY = "sugar-shelf-queue-owner-v1";
export function queueOwner(): string {
  const saved = localStorage.getItem(QUEUE_OWNER_KEY);
  if (saved && /^[a-f0-9]{64}$/.test(saved)) return saved;
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, "0")).join("");
  localStorage.setItem(QUEUE_OWNER_KEY, token);
  return token;
}
