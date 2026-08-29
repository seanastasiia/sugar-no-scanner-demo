import { describe, expect, it } from "vitest";
import { nutritionRevalidateAfter, priceRevalidateAfter } from "./data-freshness";

describe("catalog freshness windows", () => {
  const checkedAt = "2026-08-29T00:00:00.000Z";

  it("uses source-specific nutrition revalidation without expiring stored data", () => {
    expect(nutritionRevalidateAfter(checkedAt, "web")).toBe("2026-09-28T00:00:00.000Z");
    expect(nutritionRevalidateAfter(checkedAt, "retailer")).toBe("2026-11-27T00:00:00.000Z");
    expect(nutritionRevalidateAfter(checkedAt, "manufacturer")).toBe("2027-02-25T00:00:00.000Z");
    expect(nutritionRevalidateAfter(checkedAt, "label")).toBe("2027-02-25T00:00:00.000Z");
  });

  it("refreshes prices daily", () => {
    expect(priceRevalidateAfter(checkedAt)).toBe("2026-08-30T00:00:00.000Z");
  });
});
