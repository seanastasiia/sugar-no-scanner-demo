import type { ExternalCatalogIdentity, ExternalCatalogProduct } from "./external-catalog-types";

// Identity-only labels reviewed against each exact retailer packshot, 2026-09-03.
// No nutrients, barcode repairs, translations of recipes or similarity overrides.
// Changed source/pack/image metadata disables the overlay until another review.
export const REVIEWED_CEREAL_LABELS = [
  { sku: "TURT3022", pack: "250g", slug: "kukuruzu-dribsniai-su-juoduoju-sokoladu-ekologiski-250-g-turt3022-lt", image: "62/1b/20/1.png", labels: ["Cornflakes Dark Chocolate"] },
  { sku: "TURT3024", pack: "350g", slug: "seklu-ir-riesutu-granola-ekologiska-350-g-turt3024-lt", image: "5f/1f/b2/8.png", labels: ["Power Granola Nuts & Seeds"] },
  { sku: "TURT3036", pack: "375g", slug: "selenu-dribsniai-ekologiski-375-g-turt3036-lt", image: "5f/26/ba/6.png", labels: ["Bran Flakes", "Bran Flakes Organic"] },
  { sku: "TURT3038", pack: "300g", slug: "spalvoti-sausi-pusryciai-ekologiski-300-g-turt3038-lt", image: "94/d0/4a/7.png", labels: ["Color Loops"] },
  { sku: "TURT3041", pack: "300g", slug: "kakaviniai-sausi-pusryciai-su-lazdynu-riesutais-ekologiski-300-g-turt3041-lt", image: "74/b9/0d/2.png", labels: ["Cocoa Pillows Hazelnut filling", "Cocoa Pillows with Hazelnut"] },
  { sku: "TURT3044", pack: "300g", slug: "sausi-pusryciai-su-zemes-riesutu-kremu-ekologiski-300-g-turt3044-lt", image: "57/e8/f8/3.png", labels: ["Low Sugar Pillows Peanut butter"] },
  // The brand's same /products/cinnamon-cereals page calls this Crunch in English
  // and Bites in German; its 300g composition and nutrient table match this source.
  { sku: "TURT3048", pack: "300g", slug: "sausi-pusryciai-su-cinamonu-ekologiski-300-g-turt3048-lt", image: "57/e1/ea/cinamonas.png", labels: ["Cinnamon Bites", "Cinnamon Crunch"] },
  { sku: "TURT3070", pack: "250g", slug: "kakaviniai-sausi-pusryciai-su-baltymais-ekologiski-250-g-turt3070-lt", image: "49/a6/78/untitled-design-1.png", labels: ["Protein Cocoa Balls"] }
] as const;

const reviewedNames = new Set(REVIEWED_CEREAL_LABELS.flatMap((row) => row.labels.map((label) => `Turtle ${label}`)));
export const isReviewedPackageAlias = (name: string) => reviewedNames.has(name);

export function withReviewedPackageAliases<T extends ExternalCatalogProduct | ExternalCatalogIdentity>(product: T): T {
  if (product.source !== "livinn_lt" || product.brand.toLowerCase() !== "turtle") return product;
  const reviewed = REVIEWED_CEREAL_LABELS.find((row) => row.sku === product.sourceProductId);
  if (!reviewed || product.packSize.replace(/\s/g, "").toLowerCase() !== reviewed.pack ||
    product.url !== `https://www.livinn.lt/p/${reviewed.slug}` ||
    product.imageUrl !== `https://images.livinn.lt/0x0/${reviewed.image}`) return product;
  return { ...product, aliases: [...new Set([...(product.aliases || []), ...reviewed.labels.map((label) => `Turtle ${label}`)])] };
}
