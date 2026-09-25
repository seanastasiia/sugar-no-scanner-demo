import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ products: [] as Array<Record<string, unknown>> }));
vi.mock("@/lib/catalog", () => ({ getCatalog: () => state.products }));
vi.mock("./demo-scenes", () => ({ sampleResponse: () => ["a", "b", "c", "d"].map(id => ({ productId: id, observedText: id })) }));
import { onboardingComparison } from "./onboarding-comparison";
function product(id: string, score: number | null) {
  return { id, matchScore: score, imageUrl: null, nutrientsPer100g: { totalSugarG: 2.3, proteinG: 36 } };
}
describe("onboarding ranks", () => {
  beforeEach(() => { state.products = []; });
  it("uses existing Fit scores rather than shelf position", () => {
    state.products = [product("a", 91), product("b", 61), product("c", 87), product("d", 64)];
    expect(onboardingComparison().map(p => [p.id, p.rank])).toEqual([["a", 1], ["c", 2], ["d", 3], ["b", 4]]);
  });
  it("shares places for ties and leaves unknown scores unranked", () => {
    state.products = [product("a", 90), product("b", null), product("c", 90), product("d", 60)];
    expect(onboardingComparison().map(p => [p.id, p.rank])).toEqual([["a", 1], ["c", 1], ["d", 3], ["b", null]]);
  });
  it("omits missing catalog identities without inventing a rank or nutrients", () => {
    state.products = [product("c", null)];
    expect(onboardingComparison()).toEqual([{ id: "c", name: "c", imageUrl: null, score: null, rank: null, sugar: 2.3, protein: 36 }]);
  });
});
