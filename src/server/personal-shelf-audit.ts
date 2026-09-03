import { assessPersonalShelfProduct, hasContradictoryShelfNutrition, normalizeIngredientText, SHELF_MODEL_VERSION, type ShelfEvidence } from "../lib/personal-shelf-rank";
import { validWebGtin, webPack } from "./web-product-evidence";

/** Inventory records are source identities, never a claim of globally unique products. */
export interface ShelfAuditIdentity {
  id: string;
  source: string;
  title: string;
  aliases?: string[];
  category: string | null;
  brand: string | null;
  packSize: string | null;
  gtin: string | null;
  excluded?: boolean;
}

export function auditShelfInventory(inventory: ShelfAuditIdentity[], evidence: ShelfEvidence[]) {
  const duplicateSourceIds: string[] = [];
  const byId = new Map<string, ShelfAuditIdentity>();
  for (const row of inventory) {
    if (byId.has(row.id)) duplicateSourceIds.push(row.id);
    else byId.set(row.id, row);
  }
  const observations = new Map<string, ShelfEvidence>();
  const duplicateEvidenceIds: string[] = [];
  for (const row of evidence) {
    if (observations.has(row.productId)) duplicateEvidenceIds.push(row.productId);
    else observations.set(row.productId, row);
  }
  const ambiguousEvidenceIds = new Set(duplicateEvidenceIds);
  const categoryCounts: Record<string, number> = {};
  const sourceCounts: Record<string, { records: number; scored: number; provisional: number; missing_data: number; unsupported: number; excluded: number }> = {};
  const rejectedGtins: string[] = [];
  let missingGtin = 0;
  const gtins = new Map<string, ShelfAuditIdentity[]>();
  const records = [...byId.values()].map((row) => {
    const observed = observations.get(row.id);
    // Ambiguous duplicate observations cannot silently choose the first/newest recipe.
    const exact = ambiguousEvidenceIds.has(row.id) || observed?.source !== row.source ? undefined : observed;
    const assessment = assessPersonalShelfProduct({ id: row.id, category: row.category, format: "other", gtin: row.gtin, shelfEvidence: exact });
    const status = row.excluded ? "excluded" : assessment.status;
    const source = sourceCounts[row.source] ||= { records: 0, scored: 0, provisional: 0, missing_data: 0, unsupported: 0, excluded: 0 };
    source.records++;
    source[status]++;
    if (status === "unsupported") {
      const key = `${row.source}: ${row.category || "(unknown source category)"}`;
      categoryCounts[key] = (categoryCounts[key] || 0) + 1;
    }
    const gtin = validWebGtin(row.gtin);
    if (gtin) gtins.set(gtin, [...(gtins.get(gtin) || []), row]);
    else if (row.gtin) rejectedGtins.push(row.id);
    else missingGtin++;
    return { id: row.id, source: row.source, sourceCategory: row.category, category: assessment.category, status,
      score: row.excluded ? null : assessment.score, scoreRange: row.excluded ? null : assessment.scoreRange,
      missing: row.excluded ? ["excluded inventory category"] : assessment.missing,
      hasEvidence: Boolean(exact), contradictoryNutrition: hasContradictoryShelfNutrition(exact) };
  });
  const gtinReviewGroups = [...gtins].filter(([, rows]) => new Set(rows.map((row) => row.source)).size > 1).map(([gtin, rows]) => {
    const brands = new Set(rows.flatMap((row) => row.brand ? [normalizeIngredientText(row.brand).trim()] : []));
    const packs = new Set(rows.flatMap((row) => {
      const pack = webPack(row.packSize || "");
      return pack ? [pack.key] : [];
    }));
    const observed = rows.flatMap((row) => observations.has(row.id) ? [observations.get(row.id)!] : []);
    const divergentFields = (["nutritionBasis", "energyKcal", "proteinG", "totalSugarG", "saltG", "saturatedFatG", "fiberG"] as const)
      .filter((key) => new Set(observed.flatMap((row) => row[key] === null ? [] : [row[key]])).size > 1);
    return { gtin, ids: rows.map((row) => row.id), reviewFlags: [
      ...(brands.size > 1 ? ["brand labels differ"] : []),
      ...(packs.size > 1 ? ["pack sizes differ"] : []),
      ...(divergentFields.length ? [`source values differ: ${divergentFields.join(", ")}`] : [])
    ] };
  });
  // This is deliberately a candidate list only. Equal reviewed alias + brand + pack
  // can bridge languages, but never authorises recipe/evidence reuse without GTIN.
  const aliases = new Map<string, ShelfAuditIdentity[]>();
  for (const row of byId.values()) {
    const brand = row.brand ? normalizeIngredientText(row.brand).replace(/[^\p{L}\p{N}]+/gu, " ").trim() : "";
    const pack = webPack(row.packSize || "")?.key || "";
    if (!brand || !pack) continue;
    for (const value of new Set([row.title, ...(row.aliases || [])])) {
      const title = normalizeIngredientText(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      if (title.length < 8 || title.split(" ").filter(Boolean).length < 2) continue;
      const key = JSON.stringify([brand, pack, title]);
      aliases.set(key, [...(aliases.get(key) || []), row]);
    }
  }
  const multilingualReviewGroups = [...aliases.entries()].flatMap(([key, rows]) => {
    const distinct = [...new Map(rows.map((row) => [row.id, row])).values()];
    return new Set(distinct.map((row) => row.source)).size > 1
      ? [{ identityKey: JSON.parse(key) as [string, string, string], ids: distinct.map((row) => row.id) }] : [];
  }).sort((a, b) => a.ids[0].localeCompare(b.ids[0]));
  const totals: Record<(typeof records)[number]["status"], number> = { scored: 0, provisional: 0, missing_data: 0, unsupported: 0, excluded: 0 };
  for (const row of records) totals[row.status]++;
  return {
    model: SHELF_MODEL_VERSION,
    summary: { sourceRecords: inventory.length, distinctSourceIds: byId.size, totals, bySource: sourceCounts,
      evidenceObservations: evidence.length, inventoryWithEvidence: records.filter((row) => row.hasEvidence).length,
      assessable: totals.scored + totals.provisional, missingGtin, rejectedGtin: rejectedGtins.length,
      crossSourceGtinReviewGroups: gtinReviewGroups.length, multilingualReviewGroups: multilingualReviewGroups.length, globallyUniqueProducts: null },
    duplicateSourceIds: [...new Set(duplicateSourceIds)].sort(),
    duplicateEvidenceIds: [...new Set(duplicateEvidenceIds)].sort(),
    evidenceOutsideInventory: evidence.filter((row) => !byId.has(row.productId)).map((row) => row.productId).sort(),
    unsupportedCategories: Object.entries(categoryCounts).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
    rejectedGtins: rejectedGtins.sort(), gtinReviewGroups, multilingualReviewGroups, records,
    limits: ["Source rows are not globally unique products.", "GTIN groups are review candidates, not merged recipes.", "Unrecognised or missing fields remain unknown; no values are imputed.", "This offline audit does not measure photo recognition accuracy."]
  };
}
