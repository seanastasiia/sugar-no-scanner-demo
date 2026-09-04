export const lookup = { brand: "SELGA", name: "Classic biscuits 180 g", variant: "Classic", packSize: "180 g", searchTerms: [] };
export const productUrl = "https://www.livin.lv/p/selga-classic";
// Synthetic page used only for exact-source composition tests.
export const shelfUrl = "https://www.livinn.lt/p/qa-classic";
export function shelfPage() {
  return page({ sku: "qa-classic" }) + `<script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[{"name":"Home"},{"name":"Maistas"},{"name":"Sausainiai"},{"name":"QA"}]}</script>
<h3 class="title--s">Sudėtis</h3><div class="html-block"><p>Sudedamosios dalys: pilno grūdo miltai, druska.</p></div>
<h3 class="title--s">Maistinė vertė</h3><div class="html-block"><p>Maistinė vertė (100 g) - 1873 kJ/446 kcal: riebalų 16 g (iš kurių sočiųjų 2.5 g), angliavandenių 66 g (iš kurių cukrų 18 g), skaidulinių medžiagų 6 g, baltymų 6.6 g, druskos 0.48 g.</p></div>`;
}
export function page(overrides: Record<string, unknown> = {}, rows = "<tr><td>Energy</td><td>440 kcal</td></tr><tr><td>Protein</td><td>7.2 g</td></tr><tr><td>Sugars</td><td>24 g</td></tr><tr><td>Carbohydrates</td><td>61 g</td></tr>") {
  return `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "SELGA Classic biscuits 180 g", brand: "SELGA", gtin13: "4006381333931", ...overrides })}</script><table><tr><th>Nutrition per 100 g</th></tr>${rows}</table>`;
}
