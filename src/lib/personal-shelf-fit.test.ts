import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { personalShelfFit } from "./personal-shelf-fit";
import { assessPersonalShelfProduct } from "./personal-shelf-rank";
import { shelfFixture } from "../../tests/fixtures/personal-shelf";

describe("Personal Shelf presentation bands", () => {
  it.each([[0, "low"], [49, "low"], [50, "moderate"], [74, "moderate"], [75, "great"], [100, "great"]] as const)("maps %s to %s without rounding or changing the score", (score, tone) => {
    const assessment = { status: "scored" as const, score, scoreRange: null };
    expect(personalShelfFit(assessment)).toMatchObject({ tone, provisional: false });
    expect(assessment.score).toBe(score);
  });
  it.each([null, undefined, NaN, Infinity, -1, 101])("does not turn invalid/missing %s into a Low fit", (score) => {
    expect(personalShelfFit({ status: "scored", score: score as number | null, scoreRange: null })).toBeNull();
  });
  it.each(["missing_data", "unsupported"] as const)("does not label %s even if it carries a stale score", (status) => {
    expect(personalShelfFit({ status, score: 90, scoreRange: { min: 80, max: 90 } })).toBeNull();
  });
  it.each([
    [0, 9, "low", "Low fit"], [39, 49, "low", "Low fit"],
    [50, 59, "moderate", "Moderate fit"], [59, 59, "moderate", "Moderate fit"],
    [75, 85, "great", "Great fit"], [90, 100, "great", "Great fit"],
    [49, 59, "uncertain", "Low to Moderate fit"],
    [74, 84, "uncertain", "Moderate to Great fit"]
  ] as const)("retains uncertainty for %s to %s", (min, max, tone, label) => {
    expect(personalShelfFit({ status: "provisional", score: null, scoreRange: { min, max } })).toEqual({ tone, label, provisional: true });
  });
  it.each([{ min: 80, max: 70 }, { min: NaN, max: 80 }, { min: 75, max: Infinity }, { min: -1, max: 5 }, { min: 95, max: 101 }])("rejects malformed bounds %j", (scoreRange) => {
    expect(personalShelfFit({ status: "provisional", score: null, scoreRange })).toBeNull();
  });
  it("does not change evidence, category assessments, caps or original Fit", () => {
    for (const product of [shelfFixture(), shelfFixture("missing-fiber", { fiberG: null }), shelfFixture("capped", { saltG: 1.6, fiberG: null })]) {
      const before = structuredClone(product);
      const assessment = assessPersonalShelfProduct(product);
      const original = structuredClone(assessment);
      personalShelfFit(assessment);
      expect(product).toEqual(before);
      expect(assessment).toEqual(original);
    }
  });
  it("keeps every coloured badge's text contrast at least 4.5:1", () => {
    const css = readFileSync("src/components/personal-shelf-fit-badge.module.css", "utf8");
    const luminance = (hex: string) => hex.match(/\w{2}/g)!.map((part) => parseInt(part, 16) / 255)
      .map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    for (const tone of ["great", "moderate", "low"]) {
      const block = css.match(new RegExp(`\\.${tone} \\{([^}]+)\\}`))![1];
      const fill = luminance(block.match(/--personal-fit-fill: #([\da-f]{6})/)![1]);
      const ink = luminance(block.match(/--personal-fit-ink: #([\da-f]{6})/)![1]);
      expect((Math.max(fill, ink) + .05) / (Math.min(fill, ink) + .05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
