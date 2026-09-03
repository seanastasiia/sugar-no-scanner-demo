export const lookup = { brand: "SELGA", name: "Classic biscuits 180 g", variant: "Classic", packSize: "180 g", searchTerms: [] };
export const productUrl = "https://www.livin.lv/p/selga-classic";
export function page(overrides: Record<string, unknown> = {}, rows = "<tr><td>Energy</td><td>440 kcal</td></tr><tr><td>Protein</td><td>7.2 g</td></tr><tr><td>Sugars</td><td>24 g</td></tr><tr><td>Carbohydrates</td><td>61 g</td></tr>") {
  return `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "SELGA Classic biscuits 180 g", brand: "SELGA", gtin13: "4006381333931", ...overrides })}</script><table><tr><th>Nutrition per 100 g</th></tr>${rows}</table>`;
}
