import { describe, expect, it } from "vitest";
import { exactPackageBasisConversion, shelfEvidencePer100g } from "./personal-shelf-basis-conversion";

describe("exact package basis conversion", () => {
  it("reads an exact mass and volume pair without estimating density", () => {
    expect(exactPackageBasisConversion("Saldējums Druva pistāciju 1000ml/500g")).toMatchObject({
      packageMassG: 500, packageVolumeMl: 1000, factor: 2
    });
    expect(exactPackageBasisConversion("Saldējums Magnum 90ml, 70g")).toMatchObject({
      packageMassG: 70, packageVolumeMl: 90
    });
  });

  it("uses the per-item ratio for a multipack and rejects conflicting pairs", () => {
    expect(exactPackageBasisConversion("Saldējums 4x72g/100ml")).toMatchObject({
      packageMassG: 72, packageVolumeMl: 100
    });
    expect(exactPackageBasisConversion("Saldējums 90ml/70g un 100ml/80g")).toBeNull();
    expect(exactPackageBasisConversion("Dzēriens 500ml")).toBeNull();
  });

  it("converts a scoring copy and preserves the raw observation", () => {
    const raw = {
      nutritionBasis: "100ml" as const,
      basisConversion: exactPackageBasisConversion("Saldējums 1000ml/500g")!,
      energyKcal: 100, proteinG: 2, totalSugarG: 10, fiberG: null,
      saltG: 0.1, saturatedFatG: 3, carbohydrateG: 12, fatG: 5
    };
    expect(shelfEvidencePer100g(raw)).toMatchObject({
      nutritionBasis: "100g", energyKcal: 200, proteinG: 4, totalSugarG: 20,
      saltG: 0.2, saturatedFatG: 6, carbohydrateG: 24, fatG: 10
    });
    expect(raw).toMatchObject({ nutritionBasis: "100ml", energyKcal: 100 });
  });
});
