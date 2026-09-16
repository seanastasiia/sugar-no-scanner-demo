import { describe, expect, it } from "vitest";
import { shelfFixture } from "../../tests/fixtures/personal-shelf";
import { savedShelfMatches } from "./saved-shelf-match";
import type { ShelfQueueItem } from "./shelf-queue";
import type { ProductDetection } from "./types";
const row = (overrides: Partial<ShelfQueueItem> = {}): ShelfQueueItem => ({ id: "job", lookup: { brand: "Brand", name: "Salted chips", variant: "classic", packSize: "125 g" }, status: "ready", reason: "verified", missing: [], result: shelfFixture("verified-a"), updatedAt: "2026-09-11", ...overrides });
const detection = (changes: Partial<NonNullable<ProductDetection["identity"]>> = {}): ProductDetection => ({ productId: "visual:new-reading", confidence: .95, box: { x: 0, y: 0, width: .3, height: .3 }, observedText: "Brand Salted chips", identity: { brand: "Brand", name: "Salted chips", variant: "classic", packSize: "125 g", category: "Chips", matchKind: "visual_only", ...changes } });
const hit = (d: ProductDetection, rows = [row()]) => savedShelfMatches([d], rows)[d.productId];
describe("saved exact Shelf recall", () => {
  it("recalls a changed visual id with normalized case, whitespace and explicit pack units", () => { expect(hit(detection({ brand: " BRAND ", name: "salted  CHIPS", packSize: "125g" }))?.id).toBe("verified-a"); });
  it.each([{ variant: "chilli" }, { packSize: "250g" }, { packSize: null }, { name: "Salted corn chips" }, { brand: "Other" }, { variant: null }])("does not substitute another or ambiguous SKU: %j", changes => { expect(hit(detection(changes))).toBeUndefined(); });
  it("uses the verified product barcode across languages", () => { const saved = row(); saved.result = { ...saved.result!, gtin: "4006381333931" }; expect(hit(detection({ name: "Čipsi", barcode: "04006381333931" }), [saved])?.id).toBe("verified-a"); });
  it("rejects a conflicting valid barcode even with the same catalog id", () => { const saved = row(); saved.result = { ...saved.result!, gtin: "4006381333931" }; const d = { ...detection({ barcode: "5901234123457" }), productId: "verified-a" }; expect(hit(d, [saved])).toBeUndefined(); });
  it("rejects conflicting records instead of choosing by list order", () => { expect(hit(detection(), [row(), row({ result: shelfFixture("verified-b") })])).toBeUndefined(); expect(hit(detection(), [row(), row({ result: shelfFixture("verified-a", { totalSugarG: 30 }) })])).toBeUndefined(); });
  it("rechecks the current score and never recalls review or unsupported data", () => { expect(hit(detection(), [row({ status: "review" })])).toBeUndefined(); expect(hit(detection(), [row({ result: shelfFixture("verified-a", { ingredientsText: null }) })])).toBeUndefined(); });
  it("can recall the exact verified id without a readable name but rejects weak detections", () => { expect(hit({ ...detection({ name: "", packSize: null }), productId: "verified-a" })?.id).toBe("verified-a"); expect(hit({ ...detection(), confidence: .5 })).toBeUndefined(); });
});
