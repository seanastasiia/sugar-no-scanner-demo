import type { ProductRecord, ScoredProduct } from "./types";

export const SHELF_MODEL_VERSION = "personal-shelf-v1.2-bounded";
export type ShelfCategory = "chips" | "crackers" | "yogurt" | "dairy-dessert" | "bar" | "cookie" | "breakfast-cereal";
export type ShelfComponentKey = "sugar" | "protein" | "composition" | "balance";

/** A single source observation, not a mixture of similar products or estimated nutrients. */
export interface ShelfEvidence {
  productId: string;
  source: "barbora_lv" | "rimi_lv" | "livinn_lt" | "open_food_facts";
  sourceUrl: string;
  checkedAt: string;
  gtin: string | null;
  category: string;
  nutritionBasis: "100g" | "100ml";
  ingredientsText: string | null;
  ingredientsLanguage: string | null;
  energyKcal: number | null;
  proteinG: number | null;
  totalSugarG: number | null;
  fiberG: number | null;
  saltG: number | null;
  saturatedFatG: number | null;
  /** Additional exact-label fields used for consistency, not extra scoring signals. */
  carbohydrateG?: number | null;
  fatG?: number | null;
}

export function hasContradictoryShelfNutrition(evidence: ShelfEvidence | null | undefined): boolean {
  if (!evidence) return false;
  if ([evidence.carbohydrateG, evidence.fatG].some((n) => n !== null && n !== undefined && !valid(n))) return true;
  // Sugar is contained in carbs; saturates in fat. Never double count either.
  const known = [evidence.proteinG, evidence.carbohydrateG, evidence.fatG].filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0);
  return known.reduce((a, b) => a + b, 0) > 101 ||
    (typeof evidence.carbohydrateG === "number" && typeof evidence.totalSugarG === "number" && evidence.totalSugarG > evidence.carbohydrateG + 1) ||
    (typeof evidence.fatG === "number" && typeof evidence.saturatedFatG === "number" && evidence.saturatedFatG > evidence.fatG + 1);
}

/** Preserve the identity/raw observation, but never reuse a demonstrably contradictory table as Fit. */
export function applyShelfNutritionTrustGuard(product: ScoredProduct): ScoredProduct {
  if (product.shelfEvidence?.productId !== product.id || (product.gtin && product.shelfEvidence.gtin && product.gtin !== product.shelfEvidence.gtin) || !hasContradictoryShelfNutrition(product.shelfEvidence)) return product;
  return { ...product, matchScore: null, matchReason: "missing_nutrition", ratingStatus: "identity_only", ratingSignalCount: 0, ratingSignalMask: [], criterionScores: null,
    nutrientsPer100g: { proteinG: null, totalSugarG: null, fiberG: null, carbohydrateG: null } };
}

export function hasSafeShelfSource(evidence: Pick<ShelfEvidence, "source" | "sourceUrl">): boolean {
  try {
    const url = new URL(evidence.sourceUrl);
    const hosts = { barbora_lv: ["barbora.lv", "www.barbora.lv"], rimi_lv: ["www.rimi.lv", "rimi.lv"], livinn_lt: ["livinn.lt", "www.livinn.lt"], open_food_facts: ["world.openfoodfacts.org"] };
    return url.protocol === "https:" && !url.username && !url.password && !url.port && (hosts[evidence.source] || []).includes(url.hostname);
  } catch { return false; }
}

export const SHELF_CATEGORIES: Record<ShelfCategory, {
  label: string;
  weights: Record<ShelfComponentKey, number>;
  balance: { salt: number; saturatedFat: number; fiber: number };
}> = {
  chips: { label: "Chips", weights: { sugar: 10, protein: 10, composition: 30, balance: 50 }, balance: { salt: .5, saturatedFat: .3, fiber: .2 } },
  crackers: { label: "Crackers & crispbreads", weights: { sugar: 10, protein: 10, composition: 30, balance: 50 }, balance: { salt: .5, saturatedFat: .3, fiber: .2 } },
  yogurt: { label: "Spoonable yogurts", weights: { sugar: 30, protein: 25, composition: 20, balance: 25 }, balance: { salt: .35, saturatedFat: .65, fiber: 0 } },
  "dairy-dessert": { label: "Dairy desserts", weights: { sugar: 30, protein: 25, composition: 20, balance: 25 }, balance: { salt: .35, saturatedFat: .65, fiber: 0 } },
  bar: { label: "Snack bars", weights: { sugar: 30, protein: 20, composition: 25, balance: 25 }, balance: { salt: .2, saturatedFat: .4, fiber: .4 } },
  cookie: { label: "Cookies & wafers", weights: { sugar: 30, protein: 20, composition: 25, balance: 25 }, balance: { salt: .2, saturatedFat: .4, fiber: .4 } },
  "breakfast-cereal": { label: "Breakfast cereals & granola", weights: { sugar: 30, protein: 20, composition: 25, balance: 25 }, balance: { salt: .2, saturatedFat: .4, fiber: .4 } }
};

export function normalizeIngredientText(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/ё/g, "е");
}

export function shelfCategory(category: string | null | undefined, format?: string): ShelfCategory | null {
  // Use the most specific exact-source category, never brand/packaging marketing or OCR aliases.
  const path = normalizeIngredientText(category || "");
  const leaf = path.split(/[/>]/).at(-1)?.trim() || "";
  if (/drink|dzeram|geriam|питьев|joog|baby|kudik|bernu|детск/.test(path)) return null;
  // Rimi uses "musli" under both breakfast cereals and its separate cereal-bar aisle.
  if (/^(?:musli|muesli)$/.test(leaf) && /(?:^|[/>])\s*batonini\s*[/>]/.test(path)) return "bar";
  // Exact Latvian retailer leaf: savory biscuits are crackers, not sweet cookies.
  if (/^salie[- ]cepumi$/.test(leaf.trim())) return "crackers";
  const matches: ShelfCategory[] = [];
  if (/chips|crisps|cips|traskuc|чипс|krops/.test(leaf)) matches.push("chips");
  if (/cracker|crispbread|kreker|trapuc|duoniuk|хлебц|крекер/.test(leaf)) matches.push("crackers");
  if (/yogurt|yoghurt|jogurt|йогурт|skyr/.test(leaf) && !/dessert|desert/.test(leaf)) matches.push("yogurt");
  if (/dairy dessert|piena desert|pieno desert|молочн.*десерт/.test(leaf)) matches.push("dairy-dessert");
  if (/snack bar|protein bar|cereal bar|batonin|batonel|batonin|батончик|batoon/.test(leaf)) matches.push("bar");
  if (/cookie|biscuit|wafer|sausain|cepum|vafel|печень|вафл|kupsis/.test(leaf)) matches.push("cookie");
  // Dry, ready-to-eat source categories only. Do not infer from a product name,
  // a broad "cereals" aisle, cooking oats/porridge, or milk-added nutrition.
  if (/^(?:breakfast[ -]cereals?|sausi pusryciai|brokastu[- ]parslas(?:[- ]un[- ]musli)?|musli|mueslis?|granolas?|сухие завтраки|мюсли|гранола|hommikuhelbed)$/.test(leaf) && format !== "bar") matches.push("breakfast-cereal");
  if (matches.length) return matches.length === 1 ? matches[0] : null;
  return format === "bar" || format === "cookie" ? format : null;
}

/** Preserve compound ingredients and decimal commas while splitting top-level ingredients. */
export function splitIngredients(text: string): string[] {
  const cleaned = text.replace(/^(?:ingredients|sast[aā]vda[lļ]as|sudedamosios dalys|состав|koostisosad)\s*:\s*/i, "");
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < cleaned.length; i++) {
    if ("([".includes(cleaned[i])) depth++;
    if (")]".includes(cleaned[i])) depth = Math.max(0, depth - 1);
    const decimal = cleaned[i] === "," && /\d/.test(cleaned[i - 1] || "") && /\d/.test(cleaned[i + 1] || "");
    if (!depth && /[,;]/.test(cleaned[i]) && !decimal) {
      parts.push(cleaned.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(cleaned.slice(start).trim());
  return parts.filter(Boolean);
}

const word = (pattern: string) => new RegExp(`(?:^|[^\\p{L}])(?:${pattern})(?=$|[^\\p{L}])`, "u");
const sugars = word("sugar|sugars|sucrose|glucose|fructose|dextrose|syrup|honey|cukurs|cukura|cukuri|cukrus|cukraus|sirupas|sirupo|sirups|sirupa|medus|medaus|сахар|сахара|сироп|сиропа|мед|меда|suhkur|suhkru|siirup|mesi");
const sweeteners = word("sucralose|aspartame|acesulfame|stevia|steviol|sukraloze|sukraloze|aspartamas|steviolio|stevija|сукралоза|аспартам|стевия|e950|e951|e952|e954|e955|e960|erythritol|maltitol|maltitols|maltits|maltita|sorbitol|ksilitols|eritritols|эритрит|мальтит|сорбит");
const wholeBase = /whole[ -]?grain|whole[ -]?wheat|brown rice|pilngraud|pilnagrud|pilno grudo|viso grudo|цельнозер|taitera|chickpea|lentil|nut[sz]?\b|almond|oat flakes|avizu dribs|auzu parsl|avizirn|zirni|zirniu|lesiu|lesiai|migdol|lazdyn|riesut|riekst|миндал|нут\b|чечевиц|орех|kaerahelb|\bseeds?\b|sekl|semen|семен|seemn/;
const potatoCornBase = /potato|bulv|kartupel|картоф|kartul|corn|kukuruz|kukuruzu|kukuruzu|кукуруз|mais/;
const dairyBase = /^(?:organic |ekologisk\p{L}* |bio )?(?:milk|skimmed milk|pasteuri[sz]ed milk|piens|piena|vajpiens|biezpiens|pienas|pieno|молоко|молока|piim|yogurt|jogurt|йогурт)/u;
const refinedBase = /flour|starch|miltai|miltu|milti\b|krakmol|ciete|мука|муки|крахмал|jahu|tarklis|rice|ryz|risi|рис|riis|protein|olbaltum|baltym|белок/;
const isolatedBase = /starch|krakmol|ciete|крахмал|tarklis|protein|olbaltum|baltym|белок/;
const chocolateBase = /chocolate|sokola+d|шоколад/;
const fatBase = /oil|butter|alieju|ella|sviests|sviestas|масло|масла|oli\b/;

export function analyzeIngredients(text: string | null, language: string | null) {
  if (!text?.trim() || text.length > 12000 || !["en", "lv", "lt", "ru", "et"].includes(language || "")) return null;
  const parts = splitIngredients(text);
  if (!parts.length) return null;
  const first = normalizeIngredientText(parts[0]).split(/[([]/)[0];
  // Score explicit positive/negative evidence only. Unrecognized base is unknown, not clean.
  const base = sugars.test(first) ? 0 : fatBase.test(first) ? null : isolatedBase.test(first) || chocolateBase.test(first) ? 25 : wholeBase.test(first) ? 100 : dairyBase.test(first) ? 85 : potatoCornBase.test(first) ? 75 : refinedBase.test(first) ? 25 : null;
  const sugarNearStart = parts.slice(0, 3).some((part) => sugars.test(normalizeIngredientText(part)));
  return {
    firstIngredient: parts[0],
    score: base === null ? null : sugarNearStart ? Math.min(base, 40) : base,
    sugarNearStart,
    sweetenersDetected: sweeteners.test(normalizeIngredientText(text))
  };
}

export interface ShelfAssessment {
  modelVersion: typeof SHELF_MODEL_VERSION;
  category: ShelfCategory | null;
  status: "scored" | "provisional" | "missing_data" | "unsupported";
  score: number | null;
  scoreRange: { min: number; max: number } | null;
  missing: string[];
  components: Array<{ key: ShelfComponentKey; label: string; points: number; maxPoints?: number; weight: number }>;
  reasons: string[];
  tradeoffs: string[];
  cap: string | null;
}

function valid(value: number | null | undefined, max = 100): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
}
const round = (n: number) => Math.round(n * 10) / 10;
const inverse = (value: number, low: number, high: number) => 100 * Math.max(0, Math.min(1, (high - value) / (high - low)));

export function assessPersonalShelfProduct(product: Pick<ProductRecord, "id" | "gtin" | "category" | "format" | "shelfEvidence">): ShelfAssessment {
  const evidence = product.shelfEvidence;
  const category = shelfCategory(evidence?.category || product.category, product.format);
  const result: ShelfAssessment = { modelVersion: SHELF_MODEL_VERSION, category, status: "missing_data", score: null, scoreRange: null, missing: [], components: [], reasons: [], tradeoffs: [], cap: null };
  if (!category) return { ...result, status: "unsupported" };
  if (!evidence || evidence.productId !== product.id || (product.gtin && evidence.gtin && product.gtin !== evidence.gtin)) {
    return { ...result, missing: ["exact ingredient and nutrition source"] };
  }
  if (evidence.nutritionBasis !== "100g") return { ...result, status: "unsupported" };
  const config = SHELF_CATEGORIES[category];
  if (!hasSafeShelfSource(evidence) || !Number.isFinite(Date.parse(evidence.checkedAt))) result.missing.push("dated source");
  const ingredients = analyzeIngredients(evidence.ingredientsText, evidence.ingredientsLanguage);
  if (!ingredients) result.missing.push("ingredient list in a supported language");
  else if (ingredients.score === null) result.missing.push("recognized first ingredient");
  // A retailer can put curd cream in its yogurt category. Do not silently compare it as yogurt.
  if (category === "yogurt" && ingredients && /biezpiens|biezpiena|varske|varskes|curd|творог/.test(normalizeIngredientText(ingredients.firstIngredient))) result.missing.push("unambiguous product type");
  for (const [key, label] of [["energyKcal", "energy"], ["proteinG", "protein"], ["totalSugarG", "sugar"], ["saltG", "salt"], ["saturatedFatG", "saturated fat"]] as const) {
    if (!valid(evidence[key], key === "energyKcal" ? 900 : 100) || (key === "energyKcal" && evidence[key] === 0)) result.missing.push(label);
  }
  const missingFiber = Boolean(config.balance.fiber) && evidence.fiberG === null;
  // Only an explicitly absent optional value is eligible. Invalid values are not absence.
  if (config.balance.fiber && !missingFiber && !valid(evidence.fiberG)) result.missing.push("valid fiber");
  if (hasContradictoryShelfNutrition(evidence)) result.missing.push("consistent nutrition totals");
  if (valid(evidence.proteinG) && valid(evidence.energyKcal, 900) && evidence.proteinG * 4 > evidence.energyKcal * 1.15) result.missing.push("consistent protein and energy");
  if (result.missing.length) return result;
  const sugar = evidence.totalSugarG!;
  const salt = evidence.saltG!;
  const fat = evidence.saturatedFatG!;
  const proteinShare = evidence.proteinG! * 4 / evidence.energyKcal! * 100;
  const fiberScore = config.balance.fiber && !missingFiber ? Math.min(100, evidence.fiberG! / 6 * 100) : 0;
  const balance = inverse(salt, .3, 1.5) * config.balance.salt + inverse(fat, 1.5, 5) * config.balance.saturatedFat + fiberScore * config.balance.fiber;
  const raw: Record<ShelfComponentKey, number> = {
    sugar: inverse(sugar, 5, 22.5), protein: Math.min(100, proteinShare / 20 * 100), composition: ingredients!.score!, balance
  };
  const labels: Record<ShelfComponentKey, string> = { sugar: "Sugar", protein: "Protein", composition: "Food base", balance: "Salt, saturates & fiber" };
  result.components = (Object.keys(raw) as ShelfComponentKey[]).map((key) => ({ key, label: key === "balance" && !config.balance.fiber ? "Salt & saturates" : labels[key], points: round(raw[key] * config.weights[key] / 100), weight: config.weights[key] }));
  const high = [sugar > 22.5 ? "sugar" : null, salt > 1.5 ? "salt" : null, fat > 5 ? "saturated fat" : null].filter(Boolean);
  // Sum integer tenths: 6.1 + 6.3 + 2.1 must round 14.5 to 15, never 14.
  const totalTenths = result.components.reduce((sum, part) => sum + Math.round(part.points * 10), 0);
  const bounded = (tenths: number) => Math.min(high.length ? 59 : 100, Math.round(tenths / 10));
  if (missingFiber) {
    const balancePart = result.components.find((part) => part.key === "balance")!;
    const maximum = round((balance + 100 * config.balance.fiber) * config.weights.balance / 100);
    balancePart.maxPoints = maximum;
    const extraTenths = Math.round(maximum * 10) - Math.round(balancePart.points * 10);
    result.scoreRange = { min: bounded(totalTenths), max: bounded(totalTenths + extraTenths) };
    result.missing = ["fiber"];
  } else result.score = bounded(totalTenths);
  result.cap = high.length ? `Pilot ceiling 59/100: high ${high.join(" and ")} per 100 g. Protein cannot cancel this limit.` : null;
  result.status = missingFiber ? "provisional" : "scored";
  result.reasons = [`${sugar} g sugar per 100 g`, `${evidence.proteinG} g protein (${round(proteinShare)}% of energy)`, `First ingredient: ${ingredients!.firstIngredient}`];
  result.tradeoffs = [
    ...(high.length ? [`Higher ${high.join(" and ")} per 100 g`] : []),
    ...(ingredients!.sugarNearStart ? ["Sugar, honey or syrup listed within the first three ingredients (including compound ingredients)"] : []),
    ...(ingredients!.sweetenersDetected ? ["Sweetener listed; disclosed without a safety penalty"] : []),
    ...(proteinShare < 12 ? ["Less than 12% of energy from protein"] : []),
    ...(missingFiber ? ["Fiber not listed. The range covers its possible contribution, not estimated grams."] : []),
    ...(config.balance.fiber && !missingFiber && evidence.fiberG! < 3 ? ["Less than 3 g fiber per 100 g"] : [])
  ];
  if (!result.tradeoffs.length) result.tradeoffs.push("Portion size and the rest of your diet still matter");
  return result;
}

export function shelfScoreBounds(assessment: ShelfAssessment): { min: number; max: number } | null {
  return assessment.scoreRange || (assessment.score === null ? null : { min: assessment.score, max: assessment.score });
}

export function shelfScoreLabel(assessment: ShelfAssessment): string | null {
  if (assessment.scoreRange) return assessment.scoreRange.min === assessment.scoreRange.max
    ? String(assessment.scoreRange.min) : `${assessment.scoreRange.min}–${assessment.scoreRange.max}`;
  return assessment.score === null ? null : String(assessment.score);
}

export function rankPersonalShelfProducts(products: ProductRecord[]) {
  // Canonical SKU IDs/GTINs only: translations cannot create extra shelf positions.
  const seen = new Set<string>();
  const entries = [...products].sort((a, b) => a.id.localeCompare(b.id)).filter((product) => {
    const key = product.gtin || product.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((product) => ({ product, assessment: assessPersonalShelfProduct(product) }));
  const groups = (Object.keys(SHELF_CATEGORIES) as ShelfCategory[]).flatMap((category) => {
    const members = entries.filter((entry) => entry.assessment.category === category);
    if (!members.length) return [];
    const scored = members.filter((entry) => shelfScoreBounds(entry.assessment))
      .sort((a, b) => shelfScoreBounds(b.assessment)!.min - shelfScoreBounds(a.assessment)!.min || a.product.id.localeCompare(b.product.id));
    return [{ category, label: SHELF_CATEGORIES[category].label, total: members.length, scoredCount: scored.length,
      completeCount: scored.filter((entry) => entry.assessment.status === "scored").length,
      provisionalCount: scored.filter((entry) => entry.assessment.status === "provisional").length,
      entries: [...scored, ...members.filter((entry) => !shelfScoreBounds(entry.assessment))].map((entry) => {
        const bounds = shelfScoreBounds(entry.assessment);
        const rank = !bounds || scored.length < 2 ? null : scored.filter((other) => shelfScoreBounds(other.assessment)!.min > bounds.min).length + 1;
        const rankProvisional = Boolean(bounds && (entry.assessment.status === "provisional" || scored.some((other) => {
          if (other === entry || other.assessment.status !== "provisional") return false;
          const otherBounds = shelfScoreBounds(other.assessment)!;
          return bounds.min <= otherBounds.max && otherBounds.min <= bounds.max;
        })));
        const tied = !rankProvisional && entry.assessment.score !== null && scored.filter((other) => other.assessment.score === entry.assessment.score).length > 1;
        return { ...entry, rank, tied, rankProvisional };
      }) }];
  });
  return { groups, unsupported: entries.filter((entry) => !entry.assessment.category) };
}
