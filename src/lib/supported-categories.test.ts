import { describe, expect, it } from "vitest";
import { investorCategoryForRetailPath } from "./supported-categories";

describe("investor category pack", () => {
  it("includes packaged sweet and salty snacks", () => {
    expect(investorCategoryForRetailPath("Bakaleja/Uzkodas/Kartupeļu un kukurūzas čipsi")).toBe("snacks");
    expect(investorCategoryForRetailPath("Bakaleja/Saldumi/Cepumi iepakojumos")).toBe("snacks");
    expect(
      investorCategoryForRetailPath("Bakaleja/Rieksti, sēklas, žāvētas ogas, augļi un dārzeņi/Zemesrieksti")
    ).toBe("snacks");
  });

  it("includes yogurt, desserts and sweet curd snacks without claiming all dairy", () => {
    expect(investorCategoryForRetailPath("Piena produkti un olas/Jogurti un deserti/Deserti")).toBe(
      "dairy_desserts"
    );
    expect(investorCategoryForRetailPath("Piena produkti un olas/Biezpiena produkti/Glazēti sieriņi")).toBe(
      "dairy_desserts"
    );
    expect(investorCategoryForRetailPath("Piena produkti un olas/Piens/Piens")).toBeNull();
  });
});
