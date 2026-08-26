import { scoreReferenceProduct } from "@/lib/scoring";
import type { ProductDetection, ProductRecord, ScanSource, ScoredProduct } from "@/lib/types";

const sampleShelf: ProductDetection[] = [
  {
    productId: "prot-bat-sal-riekst-saldin-barebells-55-g",
    confidence: 0.98,
    box: { x: 0.01, y: 0.27, width: 0.24, height: 0.28 },
    observedText: "Barebells Salty Peanut",
    shelfPrice: {
      amount: 3.49,
      currency: "EUR",
      observedText: "Demo shelf price €3.49",
      confidence: 1
    },
    retailerOffer: {
      retailer: "Barbora",
      slug: "prot-bat-sal-riekst-saldin-barebells-55-g",
      title: "Proteīna batoniņš ar sāļiem riekstiem BAREBELLS 55g",
      brand: "BAREBELLS",
      url: "https://barbora.lv/produkti/prot-bat-sal-riekst-saldin-barebells-55-g",
      price: 2.79,
      currency: "EUR",
      unitPrice: 50.73,
      unit: "kg",
      imageUrl: "https://cdn.barbora.lv/products/25f716c3-1604-41de-8679-7f4231725f41_s.png",
      checkedAt: "2026-08-25T06:37:00.000Z",
      matchConfidence: 1,
      exactSku: true
    }
  },
  {
    productId: "prot-bat-barebells-lemon-cheesecake-55-g",
    confidence: 0.97,
    box: { x: 0.25, y: 0.27, width: 0.24, height: 0.28 },
    observedText: "Barebells Lemon Cheesecake"
  },
  {
    productId: "proteina-bat-cepuma-garsa-iconfit-55-g",
    confidence: 0.96,
    box: { x: 0.5, y: 0.27, width: 0.24, height: 0.28 },
    observedText: "ICONFIT Cookie Bliss"
  },
  {
    productId: "proteina-baton-barebells-coco-choco-55-g",
    confidence: 0.95,
    box: { x: 0.75, y: 0.27, width: 0.24, height: 0.28 },
    observedText: "Barebells Coco Choco"
  }
];

function checkoutReferenceProduct(
  product: ProductRecord,
  basis: "manufacturer_reference" | "food_composition_reference"
): ScoredProduct {
  return scoreReferenceProduct(product, basis, `${basis}_partial`);
}

const checkoutSproud = checkoutReferenceProduct(
  {
    id: "visual:sproud-barista-low-sugar-high-in-protein-drink-made-from-peas-1l",
    retailerProductId: "visual:sproud-barista-low-sugar-high-in-protein-drink-made-from-peas-1l",
    brand: "SPROUD",
    name: "Barista pea drink 1L",
    shortName: "Barista pea drink 1L",
    aliases: ["Sproud Barista", "Barista Low Sugar High in Protein Drink Made from Peas"],
    format: "other",
    category: "Plant-based drinks",
    packSizeG: 1000,
    nutritionBasis: "100ml",
    energyKcalPer100: 40,
    gtin: null,
    nutrientsPer100g: { proteinG: 2.1, fiberG: null, totalSugarG: 1.8 },
    noAddedSugarClaim: false,
    imageUrl: null,
    retailerUrl: "https://besproud.com/sv/products/barista/",
    sources: [
      {
        label: "Sproud official product page",
        url: "https://besproud.com/sv/products/barista/",
        checkedAt: "2026-08-25",
        fields: ["identity", "protein", "totalSugar"],
        status: "verified"
      }
    ],
    isGolden: false,
    accent: "mint"
  },
  "manufacturer_reference"
);

const checkoutSchnitzer = checkoutReferenceProduct(
  {
    id: "visual:schnitzer-bio-burger-buns",
    retailerProductId: "visual:schnitzer-bio-burger-buns",
    brand: "SCHNITZER",
    name: "Bio Burger Buns gluten-free 250g",
    shortName: "Bio Burger Buns 250g",
    aliases: ["Schnitzer Bio Burger Buns", "Bio Burger Buns"],
    format: "other",
    category: "Gluten-free bakery",
    packSizeG: 250,
    nutritionBasis: "100g",
    energyKcalPer100: 229,
    gtin: "4022993046076",
    nutrientsPer100g: { proteinG: 3.4, fiberG: null, totalSugarG: 3.7 },
    noAddedSugarClaim: false,
    imageUrl: null,
    retailerUrl: "https://www.schnitzer.eu/en/products/bio-burger-buns-glutenfrei",
    sources: [
      {
        label: "Schnitzer official product page",
        url: "https://www.schnitzer.eu/en/products/bio-burger-buns-glutenfrei",
        checkedAt: "2026-08-25",
        fields: ["identity", "protein", "totalSugar"],
        status: "verified"
      }
    ],
    isGolden: false,
    accent: "sun"
  },
  "manufacturer_reference"
);

const checkoutChanterelles = checkoutReferenceProduct(
  {
    id: "visual:stockmann-gailenes-chanterelles",
    retailerProductId: "visual:stockmann-gailenes-chanterelles",
    brand: "STOCKMANN",
    name: "Fresh chanterelles",
    shortName: "Fresh chanterelles",
    aliases: ["Gailenes", "Chanterelles"],
    format: "other",
    category: "Fresh mushrooms",
    packSizeG: 100,
    nutritionBasis: "100g",
    energyKcalPer100: 17,
    gtin: null,
    nutrientsPer100g: { proteinG: 2, fiberG: null, totalSugarG: 0.4 },
    noAddedSugarClaim: false,
    imageUrl: null,
    retailerUrl: "https://www.matvaretabellen.no/en/mushroom-chantherelle-raw/",
    sources: [
      {
        label: "Norwegian Food Composition Table · raw chanterelle reference",
        url: "https://www.matvaretabellen.no/en/mushroom-chantherelle-raw/",
        checkedAt: "2026-08-25",
        fields: ["protein", "totalSugar"],
        status: "secondary"
      }
    ],
    isGolden: false,
    accent: "forest"
  },
  "food_composition_reference"
);

const sampleCheckout: ProductDetection[] = [
  {
    productId: "visual:sproud-barista-low-sugar-high-in-protein-drink-made-from-peas-1l",
    catalogProductId: null,
    confidence: 0.95,
    box: { x: 0.6996165, y: 0.4544577, width: 0.3003835, height: 0.2709955 },
    observedText: "Barista Low Sugar High in Protein Drink Made from Peas 1L",
    identity: {
      brand: "Sproud",
      name: "Barista Low Sugar High in Protein Drink Made from Peas 1L",
      variant: null,
      packSize: "1L",
      category: null,
      matchKind: "visual_only"
    },
    shelfPrice: null,
    retailerOffer: null,
    nutritionLinkConfidence: 1,
    inlineProduct: checkoutSproud
  },
  {
    productId: "visual:schnitzer-bio-burger-buns",
    catalogProductId: null,
    confidence: 0.92,
    box: { x: 0.109558, y: 0.3864703, width: 0.4120444, height: 0.2015259 },
    observedText: "Bio Burger Buns",
    identity: {
      brand: "Schnitzer",
      name: "Bio Burger Buns",
      variant: null,
      packSize: null,
      category: null,
      matchKind: "visual_only"
    },
    shelfPrice: null,
    retailerOffer: null,
    nutritionLinkConfidence: 1,
    inlineProduct: checkoutSchnitzer
  },
  {
    productId: "visual:stockmann-gailenes-chanterelles",
    catalogProductId: null,
    confidence: 0.88,
    box: { x: 0.3670691, y: 0.5989704, width: 0.4562281, height: 0.2684725 },
    observedText: "Gailenes Chanterelles",
    identity: {
      brand: "Stockmann",
      name: "Gailenes Chanterelles",
      variant: null,
      packSize: null,
      category: null,
      matchKind: "visual_only"
    },
    shelfPrice: null,
    retailerOffer: null,
    nutritionLinkConfidence: 0.86,
    inlineProduct: checkoutChanterelles
  }
];

export function sampleResponse(source: ScanSource): ProductDetection[] | null {
  if (source === "sample-shelf") return sampleShelf;
  if (source === "sample-conveyor") return sampleCheckout;
  return null;
}
