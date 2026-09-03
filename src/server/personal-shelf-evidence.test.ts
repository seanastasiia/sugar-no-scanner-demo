import { beforeEach, describe, expect, it, vi } from "vitest";
import { shelfFixture } from "../../tests/fixtures/personal-shelf";
const { getDb, read, tables } = vi.hoisted(() => ({ getDb: vi.fn(), read: vi.fn(), tables: vi.fn() }));
vi.mock("./supabase", () => ({ getSupabaseAdmin: getDb }));
import { getShelfEvidence, loadShelfEvidence } from "./personal-shelf-evidence";
beforeEach(() => {
  read.mockReset(); tables.mockReset(); getDb.mockReset();
  getDb.mockReturnValue({ from: (table: string) => { tables(table); return { select: () => ({ in: () => ({ abortSignal: read }) }) }; } });
});
describe("managed exact shelf observations", () => {
  it("works without Supabase and never guesses unknown identities", async () => {
    getDb.mockReturnValue(null);
    const id = "livinn_lt:03000007174";
    expect(await loadShelfEvidence([id, "livinn_lt:missing"])).toEqual({ [id]: getShelfEvidence(id) });
  });
  it("retains local observations when storage is unavailable", async () => {
    read.mockRejectedValue(new Error("offline"));
    const id = "livinn_lt:03000007174";
    expect((await loadShelfEvidence([id]))[id]).toEqual(getShelfEvidence(id));
  });
  it("accepts only schema-valid, requested, exact-source records", async () => {
    const evidence = shelfFixture("barbora:qa").shelfEvidence!;
    const id = evidence.productId;
    read.mockResolvedValue({ data: [
      { product_id: "barbora:other", evidence: { ...evidence, productId: "barbora:other" } },
      { product_id: id, evidence: { ...evidence, sourceUrl: "https://evil.example" } },
      { product_id: id, evidence: { ...evidence, productId: "barbora:wrong" } },
      { product_id: id, evidence },
      { product_id: id, evidence: { ...evidence, proteinG: "unverified" } }
    ], error: null });
    expect(await loadShelfEvidence([id])).toEqual({ [id]: evidence });
    expect(tables).toHaveBeenCalledWith("retailer_shelf_evidence");
    expect(tables).not.toHaveBeenCalledWith("open_food_facts_shelf_evidence");
  });
  it("does not allow an ODbL record to masquerade as retailer evidence", async () => {
    const evidence = shelfFixture("barbora:qa").shelfEvidence!;
    read.mockResolvedValue({ data: [{ product_id: evidence.productId, evidence: { ...evidence, source: "open_food_facts", sourceUrl: "https://world.openfoodfacts.org/product/1234567890123" } }] });
    expect(await loadShelfEvidence([evidence.productId])).toEqual({});
  });
});
