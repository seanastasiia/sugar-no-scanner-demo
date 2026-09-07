import { createHash } from "node:crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabase";
import { normalizeRetailText } from "./barbora-catalog";

const storedSchema = z.object({
  gtin: z.string().regex(/^\d{14}$/),
  record: z.record(z.string(), z.unknown()),
  checked_at: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  blocked: z.literal(false)
});

export type SharedOffRecord = { gtin: string; record: Record<string, unknown>; checkedAt: string };

export function sharedOffLookupKey(input: {
  brand: string;
  name: string;
  variant?: string;
  packSize?: string;
}, barcode = ""): string {
  const normalized = [input.brand, input.name, input.variant || "", input.packSize || "", barcode]
    .map((value) => normalizeRetailText(value));
  return "off-v1:" + createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function canonicalSharedOffGtin(value: unknown): string | null {
  if (typeof value !== "string" || !/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value) || /^0+$/.test(value)) return null;
  const digits = [...value].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 ? 1 : 3), 0);
  return (10 - sum % 10) % 10 === check ? value.padStart(14, "0") : null;
}

function enabled() { return process.env.SHARED_OFF_CATALOG_ENABLED === "true"; }
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const signal = () => AbortSignal.timeout(1_500);

/** ODbL records stay in their own table and are never mixed with retailer-page cards. */
export async function readSharedOffRecord(gtin: string): Promise<SharedOffRecord | null> {
  const canonical = canonicalSharedOffGtin(gtin);
  if (!enabled() || !canonical) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  try {
    const { data, error } = await db.from("shared_open_food_facts_products")
      .select("gtin,record,checked_at,blocked").eq("gtin", canonical).abortSignal(signal()).maybeSingle();
    const parsed = error ? null : storedSchema.safeParse(data);
    if (!parsed?.success || canonicalSharedOffGtin(parsed.data.record.code) !== canonical) return null;
    return { gtin: canonical, record: parsed.data.record, checkedAt: parsed.data.checked_at };
  } catch { return null; }
}

export async function readSharedOffRecordByAlias(aliasKey: string): Promise<SharedOffRecord | null> {
  if (!enabled() || !/^off-v1:[a-f0-9]{64}$/.test(aliasKey)) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  try {
    const { data, error } = await db.from("shared_open_food_facts_aliases")
      .select("gtin,blocked").eq("alias_key", aliasKey).abortSignal(signal()).maybeSingle();
    if (error || !data || data.blocked || !canonicalSharedOffGtin(data.gtin)) return null;
    return readSharedOffRecord(data.gtin);
  } catch { return null; }
}

export async function promoteSharedOffRecord(input: {
  gtin: string;
  record: Record<string, unknown>;
  checkedAt: string;
  identity: unknown;
  composition: unknown;
  aliasKey?: string;
}): Promise<"accepted" | "conflict" | "unavailable"> {
  const gtin = canonicalSharedOffGtin(input.gtin);
  const aliasKey = input.aliasKey || "";
  if (!enabled() || !gtin || canonicalSharedOffGtin(input.record.code) !== gtin || !Number.isFinite(Date.parse(input.checkedAt))) {
    return "unavailable";
  }
  if (aliasKey && !/^off-v1:[a-f0-9]{64}$/.test(aliasKey)) return "unavailable";
  const db = getSupabaseAdmin();
  if (!db) return "unavailable";
  try {
    const identityHash = hash(input.identity);
    const compositionHash = hash(input.composition);
    const versionHash = hash({ gtin, aliasKey, record: input.record, identityHash, compositionHash });
    const { data, error } = await db.rpc("promote_shared_open_food_facts_product", {
      p_gtin: gtin,
      p_alias_key: aliasKey,
      p_record: input.record,
      p_checked_at: input.checkedAt,
      p_identity_hash: identityHash,
      p_composition_hash: compositionHash,
      p_version_hash: versionHash
    }).abortSignal(signal());
    if (error) return "unavailable";
    return data?.status === "accepted" ? "accepted" : data?.status === "conflict" ? "conflict" : "unavailable";
  } catch { return "unavailable"; }
}
