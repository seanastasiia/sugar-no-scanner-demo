import { NextResponse } from "next/server";
import { z } from "zod";
import { productWithAlternatives } from "@/server/catalog-repository";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = z.string().min(1).max(240).safeParse((await context.params).id);
  if (!parsed.success) return NextResponse.json({ error: "invalid_product_id" }, { status: 400 });
  const result = await productWithAlternatives(parsed.data);
  if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(result, {
    headers: { "cache-control": "private, max-age=300" }
  });
}
