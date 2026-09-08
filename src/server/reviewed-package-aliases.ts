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

export const REVIEWED_RETAIL_LABELS = [
  {
    source: "rimi_lv",
    sku: "1016943",
    brand: "Nicks",
    pack: "50g",
    title: "Prot. bat. Nicks ar sāļaj. zemesr. sald. 50g",
    url: "https://www.rimi.lv/e-veikals/lv/produkti/iepakota-partika/speciala-partika-un-galetes/diabetiskie-produkti/prot-bat-nicks-ar-salaj-zemesr-sald-50g/p/1016943",
    labels: [
      "Nick's Peanuts n' Fudge",
      "Nick's Peanuts n' Fudge Chocolate Bar",
      "Nick's Peanuts & Fudge Protein Bar"
    ]
  }
] as const;

export const REVIEWED_BARBORA_PACKAGE_LABELS = [
  { slug: "prot-bat-cepums-un-karamele-nutego-45-g", brand: "NUTEGO", pack: "45g",
    title: "Proteīna batoniņš cepums un karamele NUTEGO 45g",
    labels: ["Nutego Protein Bar Crunchy Cookies & Caramel"], brandAliases: [] },
  { slug: "prot-bat-kokosr-un-karamele-nutego-45-g", brand: "NUTEGO", pack: "45g",
    title: "Proteīna batoniņš kokosrieksts un karamele NUTEGO 45g",
    labels: ["Nutego Protein Bar Crunchy Coconut & Caramel"], brandAliases: [] },
  { slug: "sok-trif-prot-zemesr-pure-chocolate-40-g", brand: "PURE CHOCOLATE", pack: "40g",
    title: "Šokolādes trifeles PURE CHOCOLATE ar proteīna zemesriekstu krēmu 40g",
    labels: ["Pure Chocolate Truffle Peanut Protein"], brandAliases: ["PURE"] },
  { slug: "sokolad-bat-the-beginnings-flapjack-60-g", brand: "THE BEGINNINGS", pack: "60g",
    title: "Šokolādes batoniņš THE BEGINNINGS FlapJack 60g",
    labels: ["The Beginnings Flapjacks Chocolate"], brandAliases: ["FLAPJACKS"] },
  { slug: "karamelu-bat-the-beginnings-flapjack-60-g", brand: "THE BEGINNINGS", pack: "60g",
    title: "Karameļu batoniņš THE BEGINNINGS FlapJack 60g",
    labels: ["The Beginnings Flapjacks Caramel"], brandAliases: ["FLAPJACKS"] },
  { slug: "upenu-baton-the-beginnings-flapjack-60-g", brand: "THE BEGINNINGS", pack: "60g",
    title: "Upeņu batoniņš THE BEGINNINGS FlapJack 60g",
    labels: ["The Beginnings Flapjacks Blackcurrant"], brandAliases: ["FLAPJACKS"] },
  { slug: "zemesr-bat-the-beginnings-flapjack-60-g", brand: "THE BEGINNINGS", pack: "60g",
    title: "Zemesriekstu batoniņš THE BEGINNINGS FlapJack 60g",
    labels: ["The Beginnings Flapjacks Peanut Butter"], brandAliases: ["FLAPJACKS"] }
] as const;

export function reviewedBarboraPackageIdentity(product: {
  slug: string;
  brand: string;
  packSize: string;
  title: string;
}): { labels: readonly string[]; brandAliases: readonly string[] } | null {
  const reviewed = REVIEWED_BARBORA_PACKAGE_LABELS.find((row) => row.slug === product.slug);
  if (!reviewed || product.brand !== reviewed.brand || product.title !== reviewed.title ||
    product.packSize.replace(/\s/g, "").toLowerCase() !== reviewed.pack) return null;
  return { labels: reviewed.labels, brandAliases: reviewed.brandAliases };
}

const reviewedNames = new Set([
  ...REVIEWED_CEREAL_LABELS.flatMap((row) => row.labels.map((label) => `Turtle ${label}`)),
  ...REVIEWED_RETAIL_LABELS.flatMap((row) => row.labels)
]);
export const isReviewedPackageAlias = (name: string) => reviewedNames.has(name);

export function withReviewedPackageAliases<T extends ExternalCatalogProduct | ExternalCatalogIdentity>(product: T): T {
  const retail = REVIEWED_RETAIL_LABELS.find((row) => row.source === product.source && row.sku === product.sourceProductId);
  if (retail && product.brand === retail.brand && product.packSize.replace(/\s/g, "").toLowerCase() === retail.pack &&
    product.title === retail.title && product.url === retail.url) {
    return { ...product, aliases: [...new Set([...(product.aliases || []), ...retail.labels])] };
  }
  if (product.source !== "livinn_lt" || product.brand.toLowerCase() !== "turtle") return product;
  const reviewed = REVIEWED_CEREAL_LABELS.find((row) => row.sku === product.sourceProductId);
  if (!reviewed || product.packSize.replace(/\s/g, "").toLowerCase() !== reviewed.pack ||
    product.url !== `https://www.livinn.lt/p/${reviewed.slug}` ||
    product.imageUrl !== `https://images.livinn.lt/0x0/${reviewed.image}`) return product;
  return { ...product, aliases: [...new Set([...(product.aliases || []), ...reviewed.labels.map((label) => `Turtle ${label}`)])] };
}
