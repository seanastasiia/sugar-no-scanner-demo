export type InvestorCategory = "snacks" | "dairy_desserts";

const exactSnackCategories = new Set([
  "Bakaleja/Graudaugu pārslas, putras un batoniņi/Musli un auzu batoniņi",
  "Bakaleja/Speciālā pārtika/Produkti ar augstu proteīna saturu",
  "Maize un konditorejas izstrādājumi/Maizes aizstājēji un citi miltu produkti/Galetes un sausmaizītes",
  "Gaļa, zivs un gatavā kulinārija/Gaļas un mājputnu produkti/Gaļas uzkodas",
  "Piena produkti un olas/Siers/Uzkodu siers un sieru nūjiņas"
]);

const exactDairyDessertCategories = new Set([
  "Piena produkti un olas/Biezpiena produkti/Glazēti sieriņi",
  "Piena produkti un olas/Biezpiena produkti/Saldais biezpiens"
]);

export function investorCategoryForRetailPath(category: string | null | undefined): InvestorCategory | null {
  if (!category) return null;
  if (
    category.startsWith("Bakaleja/Uzkodas/") ||
    category.startsWith("Bakaleja/Saldumi/") ||
    category.startsWith("Bakaleja/Rieksti, sēklas, žāvētas ogas, augļi un dārzeņi/") ||
    exactSnackCategories.has(category)
  ) {
    return "snacks";
  }
  if (
    category.startsWith("Piena produkti un olas/Jogurti un deserti/") ||
    exactDairyDessertCategories.has(category)
  ) {
    return "dairy_desserts";
  }
  return null;
}
