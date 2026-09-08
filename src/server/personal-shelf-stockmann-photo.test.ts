import { describe, expect, it } from "vitest";
import { assessPersonalShelfProduct, shelfScoreBounds } from "../lib/personal-shelf-rank";
import { getIndexedBarboraProductWithAlternatives } from "./barbora-nutrition-index";
import { getExternalCatalogProductById } from "./external-catalog";

const photographedProducts = [
  ["prot-bat-cepums-un-karamele-nutego-45-g", "bar"],
  ["prot-bat-kokosr-un-karamele-nutego-45-g", "bar"],
  ["sok-trif-prot-zemesr-pure-chocolate-40-g", "chocolate"],
  ["sokolad-bat-the-beginnings-flapjack-60-g", "bar"],
  ["zemesr-bat-the-beginnings-flapjack-60-g", "bar"],
  ["kakao-proteina-baton-the-beginnings-40-g", "bar"],
  ["ananasu-protein-bat-the-beginnings-40-g", "bar"],
  ["tomatu-merce-spilva-luksus-510-g", "sauce"],
  ["merce-santa-maria-wok-pad-thai-150-g", "sauce"],
  ["stirfryhoisin-kipl-merce-bluedragon-120-g", "sauce"],
] as const;

describe("Personal Shelf Rank for the photographed Stockmann shelves", () => {
  it.each(photographedProducts)("keeps exact sourced %s assessable as %s", (slug, category) => {
    const product = getIndexedBarboraProductWithAlternatives(slug)?.product;
    expect(product, `missing exact catalog product for ${slug}`).toBeTruthy();
    expect(product!.shelfEvidence?.sourceUrl).toContain("barbora.lv");

    const assessment = assessPersonalShelfProduct(product!);
    expect(assessment.category).toBe(category);
    expect(shelfScoreBounds(assessment), `missing Personal Shelf Rank for ${slug}`).not.toBeNull();
  });

  it("keeps the exact photographed NICK'S retailer card assessable", () => {
    const product = getExternalCatalogProductById("rimi_lv:1016943");
    expect(product).toBeTruthy();
    expect(product!.shelfEvidence?.sourceUrl).toContain("rimi.lv");
    const assessment = assessPersonalShelfProduct(product!);
    expect(assessment.category).toBe("bar");
    expect(shelfScoreBounds(assessment)).not.toBeNull();
  });
});
