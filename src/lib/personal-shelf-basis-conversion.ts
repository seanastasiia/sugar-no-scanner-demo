export interface ExactPackageBasisConversion {
  sourceBasis: "100ml";
  targetBasis: "100g";
  method: "exact_package_mass_volume";
  packageMassG: number;
  packageVolumeMl: number;
  factor: number;
  sourceTitle: string;
}

type Quantity = { amount: number; unit: "g" | "ml"; count: number | null };

const rounded = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

function quantity(amount: string, unit: string, count?: string): Quantity | null {
  let value = Number(amount.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  const normalizedUnit = unit.toLowerCase();
  if (normalizedUnit === "kg" || normalizedUnit === "l") value *= 1_000;
  else if (normalizedUnit === "cl") value *= 10;
  return {
    amount: value,
    unit: /^(?:ml|cl|l)$/.test(normalizedUnit) ? "ml" : "g",
    count: count ? Number(count) : null
  };
}

/**
 * Accept only a mass/volume pair printed together in the exact catalog title.
 * A multiplier describes the number of identical units and therefore cancels
 * out of the density ratio (for example 4x72 g / 100 ml means 72 g per 100 ml).
 */
export function exactPackageBasisConversion(sourceTitle: string): ExactPackageBasisConversion | null {
  if (!sourceTitle || sourceTitle.length > 500) return null;
  const normalized = sourceTitle.normalize("NFKC").toLowerCase().replaceAll("×", "x")
    .replace(/кг/g, "kg").replace(/мл/g, "ml").replace(/г(?!\p{L})/gu, "g").replace(/л(?!\p{L})/gu, "l");
  const pairPattern = /(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|ml|cl|g|l)\s*(?:\/|,)\s*(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|ml|cl|g|l)(?!\p{L})/gu;
  const pairs = [...normalized.matchAll(pairPattern)].flatMap((match) => {
    const left = quantity(match[2], match[3], match[1]);
    const right = quantity(match[5], match[6], match[4]);
    if (!left || !right || left.unit === right.unit) return [];
    if (left.count && right.count && left.count !== right.count) return [];
    const mass = left.unit === "g" ? left.amount : right.amount;
    const volume = left.unit === "ml" ? left.amount : right.amount;
    const density = mass / volume;
    // Wide physical guard: enough for aerated ice cream and dense sorbet, but
    // rejects malformed quantities before they can affect a score.
    return density >= 0.3 && density <= 2 ? [{ mass, volume }] : [];
  });
  const unique = [...new Map(pairs.map((pair) => [`${pair.mass}|${pair.volume}`, pair])).values()];
  if (unique.length !== 1) return null;
  const pair = unique[0];
  return {
    sourceBasis: "100ml",
    targetBasis: "100g",
    method: "exact_package_mass_volume",
    packageMassG: pair.mass,
    packageVolumeMl: pair.volume,
    factor: rounded(pair.volume / pair.mass),
    sourceTitle
  };
}

type ConvertibleEvidence = {
  nutritionBasis: "100g" | "100ml";
  basisConversion?: ExactPackageBasisConversion;
  energyKcal: number | null;
  proteinG: number | null;
  totalSugarG: number | null;
  fiberG: number | null;
  saltG: number | null;
  saturatedFatG: number | null;
  carbohydrateG?: number | null;
  fatG?: number | null;
};

/** Return a scoring-only copy. Raw source values and their 100 ml basis remain stored unchanged. */
export function shelfEvidencePer100g<T extends ConvertibleEvidence>(evidence: T): T | null {
  if (evidence.nutritionBasis === "100g") return evidence;
  const conversion = evidence.basisConversion;
  if (!conversion || conversion.sourceBasis !== "100ml" || conversion.targetBasis !== "100g" ||
    conversion.method !== "exact_package_mass_volume" ||
    !Number.isFinite(conversion.packageMassG) || !Number.isFinite(conversion.packageVolumeMl) ||
    conversion.packageMassG <= 0 || conversion.packageVolumeMl <= 0) return null;
  const factor = conversion.packageVolumeMl / conversion.packageMassG;
  if (conversion.packageMassG / conversion.packageVolumeMl < 0.3 || conversion.packageMassG / conversion.packageVolumeMl > 2 ||
    Math.abs(factor - conversion.factor) > 0.00001) return null;
  const convert = (value: number | null | undefined) => value === null || value === undefined ? value : rounded(value * factor);
  return {
    ...evidence,
    nutritionBasis: "100g",
    energyKcal: convert(evidence.energyKcal) as number | null,
    proteinG: convert(evidence.proteinG) as number | null,
    totalSugarG: convert(evidence.totalSugarG) as number | null,
    fiberG: convert(evidence.fiberG) as number | null,
    saltG: convert(evidence.saltG) as number | null,
    saturatedFatG: convert(evidence.saturatedFatG) as number | null,
    carbohydrateG: convert(evidence.carbohydrateG),
    fatG: convert(evidence.fatG)
  };
}
