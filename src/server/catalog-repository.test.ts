import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));

vi.mock("./supabase", () => ({ getSupabaseAdmin }));

function supabaseWithResult(result: { data: unknown[] | null; error: { message: string } | null }) {
  const order = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));
  return { from };
}

describe("catalog repository Supabase fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    getSupabaseAdmin.mockReset();
  });

  it("keeps the checked-in catalog available when the Supabase products table is missing", async () => {
    getSupabaseAdmin.mockReturnValue(
      supabaseWithResult({
        data: null,
        error: { message: "Could not find the table 'public.products' in the schema cache" }
      })
    );

    const { listProducts } = await import("./catalog-repository");
    const products = await listProducts();

    expect(products.length).toBeGreaterThan(0);
  });

  it("keeps the checked-in catalog available when the managed table is not seeded yet", async () => {
    getSupabaseAdmin.mockReturnValue(supabaseWithResult({ data: [], error: null }));

    const { listProducts } = await import("./catalog-repository");
    const products = await listProducts();

    expect(products.length).toBeGreaterThan(0);
  });
});
