import { NextResponse } from "next/server";
import { isAuthorized } from "@/server/auth";
import { productWithAlternatives } from "@/server/catalog-repository";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorized())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const result = await productWithAlternatives(id);
  if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(result, {
    headers: { "cache-control": "private, max-age=300" }
  });
}
