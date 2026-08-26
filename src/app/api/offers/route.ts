import { NextResponse } from "next/server";
import { z } from "zod";
import { getKnownBarboraOfferBySlug } from "@/server/barbora-catalog";

const requestSchema = z.object({
  slugs: z.array(z.string().min(1).max(180).regex(/^[a-z0-9-]+$/)).min(1).max(8)
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_offer_request" }, { status: 400 });

  const slugs = [...new Set(parsed.data.slugs)];
  const resolved = await Promise.all(
    slugs.map(async (slug) => [slug, await getKnownBarboraOfferBySlug(slug).catch(() => null)] as const)
  );

  return NextResponse.json(
    { offers: Object.fromEntries(resolved) },
    { headers: { "cache-control": "private, max-age=300" } }
  );
}
