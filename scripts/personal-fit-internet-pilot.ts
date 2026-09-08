import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { assessPersonalShelfProduct, shelfScoreBounds, type ShelfEvidence } from "../src/lib/personal-shelf-rank";
import { normalizeRetailText } from "../src/server/barbora-catalog";
import type { ExternalCatalogIdentity, ExternalCatalogProduct } from "../src/server/external-catalog-types";
import { openFoodFactsProductNames, type OpenFoodFactsBulkRecord } from "../src/server/open-food-facts-bulk";
import { offShelfEvidence } from "../src/server/personal-shelf-parser";
import { approvedWebProductUrl, fetchVerifiedWebProduct, validWebGtin, webPack } from "../src/server/web-product-evidence";

const dir = ".catalog-sync/internet-pilot-2026-09-08";
const mode = process.argv[2] || "plan";
const json = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, "utf8"));
const atomic = async (file: string, value: unknown) => {
  await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2) + "\n");
  await rename(`${file}.tmp`, file);
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const assess = (e: ShelfEvidence) => assessPersonalShelfProduct({ id: e.productId, gtin: e.gtin, category: e.category, format: "other", shelfEvidence: e });

type AuditRow = { id: string; source: string; category: string | null; status: string; hasEvidence: boolean; missing: string[]; contradictoryNutrition: boolean };
type Identity = {
  id: string; source: string; title: string; aliases: string[]; brand: string; gtin: string; category: string | null;
  packSize: string; sourceUrl: string; cohort: "no_evidence" | "one_blocker"; priorMissing: string[];
};
type Baseline = { commit: string; checkedAt: string; inputHashes: Record<string, string>; selected: Identity[] };
type Attempt = {
  id: string; off?: { attemptedAt: string; status: string; error?: string; evidence?: ShelfEvidence };
  google?: { attemptedAt: string; status: string; sourceUrl?: string | null; sourceHost?: string | null; error?: string; evidence?: ShelfEvidence };
};
type Checkpoint = { attempts: Attempt[]; offRetryNotBefore?: string | null };

function stratified(rows: Identity[], count: number): Identity[] {
  const groups = new Map<string, Identity[]>();
  for (const row of rows) {
    const key = `${row.source}|${row.category || "unknown"}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  for (const group of groups.values()) group.sort((a, b) => hash(a.id).localeCompare(hash(b.id)));
  const keys = [...groups.keys()].sort();
  const selected: Identity[] = [];
  while (selected.length < count) {
    let added = 0;
    for (const key of keys) {
      const row = groups.get(key)?.shift();
      if (row) { selected.push(row); added++; }
      if (selected.length === count) break;
    }
    if (!added) throw new Error(`Only ${selected.length} eligible identities for requested ${count}`);
  }
  return selected;
}

async function catalogInputs() {
  const files = ["rimi-catalog", "livinn-food-index", "open-food-facts-lv", "open-food-facts-regional"];
  const inputHashes: Record<string, string> = {};
  const identities = new Map<string, ExternalCatalogProduct | ExternalCatalogIdentity>();
  for (const name of files) {
    const body = await readFile(`data/${name}.generated.json`, "utf8");
    inputHashes[name] = hash(body);
    for (const row of JSON.parse(body) as Array<ExternalCatalogProduct | ExternalCatalogIdentity>) {
      const id = `${row.source === "open_food_facts" ? "off" : row.source}:${row.sourceProductId}`;
      identities.set(id, row);
    }
  }
  return { identities, inputHashes };
}

function exactOffPilotEvidence(raw: OpenFoodFactsBulkRecord, expected: Identity, checkedAt: string): ShelfEvidence | null {
  if (!raw.code || validWebGtin(raw.code) !== validWebGtin(expected.gtin) || raw.obsolete || raw.no_nutrition_data ||
    (Array.isArray(raw.data_quality_errors_tags) && raw.data_quality_errors_tags.length)) return null;
  const brands = (raw.brands || "").split(",").map(normalizeRetailText);
  if (expected.brand && !brands.includes(normalizeRetailText(expected.brand))) return null;
  const sourceNames = new Set(openFoodFactsProductNames(raw).map(normalizeRetailText));
  if (![expected.title, ...expected.aliases].some((name) => sourceNames.has(normalizeRetailText(name)))) return null;
  const expectedPack = webPack(expected.packSize), sourcePack = webPack(raw.quantity || "");
  if (expectedPack && (!sourcePack || expectedPack.key !== sourcePack.key)) return null;
  const nutrients = { ...raw.nutriments } as Record<string, unknown>;
  for (const name of ["energy-kcal", "energy-kj", "proteins", "sugars", "fiber", "salt", "sodium", "saturated-fat", "carbohydrates", "fat"]) {
    if (nutrients[`${name}_modifier`]) delete nutrients[`${name}_100g`];
  }
  return offShelfEvidence({ ...raw, nutriments: nutrients }, checkedAt);
}

const discoveredSchema = z.object({
  exactProductMatch: z.boolean(), matchedBarcode: z.string().max(32).nullable(),
  sourceProductUrl: z.string().max(2_000).nullable(), confidence: z.number().min(0).max(1), evidence: z.string().max(500)
});
function discovered(text: string) {
  const value = text.match(/PRODUCT_URL_JSON:\s*(\{[^\n]+\})/i)?.[1];
  if (!value) return null;
  try { const parsed = discoveredSchema.safeParse(JSON.parse(value)); return parsed.success ? parsed.data : null; }
  catch { return null; }
}

async function fetchOff(row: Identity): Promise<NonNullable<Attempt["off"]>> {
  const attemptedAt = new Date().toISOString();
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(row.gtin)}`, {
      headers: { "user-agent": "Sugar.no Personal Fit pilot/1.0 (https://sugar.no)" }, signal: AbortSignal.timeout(15_000)
    });
    if (response.status === 429 || response.status === 503) return { attemptedAt, status: "rate_limited", error: `HTTP ${response.status}` };
    if (!response.ok) return { attemptedAt, status: "source_unavailable", error: `HTTP ${response.status}` };
    const body = await response.json() as { product?: OpenFoodFactsBulkRecord };
    const evidence = body.product ? exactOffPilotEvidence(body.product, row, attemptedAt) : null;
    if (!evidence) return { attemptedAt, status: "identity_or_quality_rejected" };
    return { attemptedAt, status: shelfScoreBounds(assess(evidence)) ? "assessable" : "exact_but_incomplete", evidence };
  } catch (error) { return { attemptedAt, status: "request_failed", error: error instanceof Error ? error.message : "request failed" }; }
}

async function searchExactPage(ai: GoogleGenAI, row: Identity): Promise<NonNullable<Attempt["google"]>> {
  const attemptedAt = new Date().toISOString();
  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_WEB_NUTRITION_MODEL || process.env.GEMINI_MODEL || "gemini-3.7-flash",
      contents: `Use Google Search now. Find one direct product page for barcode ${row.gtin}, brand "${row.brand}", product "${row.title}", pack "${row.packSize}". ` +
        `The page must describe the exact packaged SKU and show the same barcode. Do not return a search-results page, category page, recipe, marketplace listing without the barcode, or a similar flavor/size. ` +
        `Do not estimate or report nutrition numbers. End with exactly one single-line JSON object prefixed PRODUCT_URL_JSON:. ` +
        `It must contain exactProductMatch, matchedBarcode, sourceProductUrl (direct HTTPS page or null), confidence from 0 to 1, and a short evidence string.`,
      config: { httpOptions: { timeout: 30_000 }, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, temperature: 0, tools: [{ googleSearch: {} }] }
    });
    const candidate = discovered(response.text || "");
    if (!candidate || !candidate.exactProductMatch || candidate.confidence < 0.9 ||
      validWebGtin(candidate.matchedBarcode) !== validWebGtin(row.gtin) || !candidate.sourceProductUrl) {
      return { attemptedAt, status: "no_exact_url" };
    }
    const approved = approvedWebProductUrl(candidate.sourceProductUrl);
    let sourceHost: string | null = null;
    try { sourceHost = new URL(candidate.sourceProductUrl).hostname; } catch { /* reported below */ }
    if (!approved) return { attemptedAt, status: "unreviewed_source", sourceUrl: candidate.sourceProductUrl, sourceHost };
    process.env.SHARED_WEB_SHELF_EVIDENCE_ENABLED = "true";
    const page = await fetchVerifiedWebProduct({ brand: row.brand, name: row.title, variant: "", packSize: row.packSize, searchTerms: row.aliases, categoryHint: null, barcode: row.gtin }, approved);
    const evidence = page?.product.canonicalShelfEvidence;
    if (!page) return { attemptedAt, status: "page_identity_rejected", sourceUrl: approved, sourceHost };
    if (!evidence) return { attemptedAt, status: "page_has_no_complete_parser", sourceUrl: approved, sourceHost };
    return { attemptedAt, status: shelfScoreBounds(assess(evidence)) ? "assessable" : "exact_but_incomplete", sourceUrl: approved, sourceHost, evidence };
  } catch (error) { return { attemptedAt, status: "request_failed", error: error instanceof Error ? error.message : "request failed" }; }
}

await mkdir(dir, { recursive: true });
if (mode === "plan") {
  try { await readFile(`${dir}/baseline.json`); throw new Error("Pilot is already frozen; use run or report"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const auditBody = await readFile(".catalog-sync/personal-fit-catalog-audit.json", "utf8");
  const audit = JSON.parse(auditBody) as { records: AuditRow[] };
  const { identities, inputHashes } = await catalogInputs();
  inputHashes.audit = hash(auditBody);
  const eligible = audit.records.flatMap((record): Identity[] => {
    const source = identities.get(record.id);
    const gtin = source?.gtin || "";
    const cohort = !record.hasEvidence ? "no_evidence" : record.missing.length === 1 ? "one_blocker" : null;
    if (record.status !== "missing_data" || record.contradictoryNutrition || !record.category || !cohort || !source || !validWebGtin(gtin)) return [];
    return [{ id: record.id, source: record.source, title: source.title, aliases: source.aliases || [], brand: source.brand, gtin,
      category: record.category, packSize: source.packSize, sourceUrl: source.url, cohort, priorMissing: record.missing }];
  });
  const noEvidence = stratified(eligible.filter((row) => row.cohort === "no_evidence"), 53);
  const oneBlocker = stratified(eligible.filter((row) => row.cohort === "one_blocker"), 47);
  const selected = [...noEvidence, ...oneBlocker];
  if (selected.length !== 100 || new Set(selected.map((row) => row.id)).size !== 100) throw new Error("Expected 100 distinct pilot identities");
  const baseline: Baseline = { commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), checkedAt: new Date().toISOString(), inputHashes, selected };
  await atomic(`${dir}/baseline.json`, baseline);
  await atomic(`${dir}/checkpoint.json`, { attempts: [], offRetryNotBefore: null } satisfies Checkpoint);
  console.log(JSON.stringify({ selected: 100, cohorts: { noEvidence: 53, oneBlocker: 47 },
    bySource: Object.fromEntries([...new Set(selected.map((row) => row.source))].map((source) => [source, selected.filter((row) => row.source === source).length])),
    paidProviderCallsPlanned: 100, promoted: 0 }));
} else if (mode === "run") {
  const baseline = await json<Baseline>(`${dir}/baseline.json`);
  const checkpoint = await json<Checkpoint>(`${dir}/checkpoint.json`);
  const attempts = new Map(checkpoint.attempts.map((row) => [row.id, row]));
  let checkpointWrites = Promise.resolve();
  const saveCheckpoint = () => {
    checkpointWrites = checkpointWrites.then(() => atomic(`${dir}/checkpoint.json`, { ...checkpoint, attempts: [...attempts.values()] }));
    return checkpointWrites;
  };
  for (const [index, row] of baseline.selected.entries()) {
    const attempt = attempts.get(row.id) || { id: row.id };
    if (!attempt.off || attempt.off.status === "rate_limited") {
      const off = await fetchOff(row);
      attempt.off = off; attempts.set(row.id, attempt);
      await saveCheckpoint();
      if (off.status === "rate_limited") break;
      if ((index + 1) % 10 === 0) console.log(JSON.stringify({ phase: "off", completed: index + 1, total: 100 }));
      // Stay below the effective product-endpoint allowance observed by this
      // bounded pilot; a 429 still stops immediately and is resumed later.
      await new Promise((done) => setTimeout(done, 3_100));
    }
  }
  const offComplete = baseline.selected.every((row) => {
    const status = attempts.get(row.id)?.off?.status;
    return status && status !== "rate_limited";
  });
  if (!offComplete) {
    console.log(JSON.stringify({ phase: "off_paused", completed: [...attempts.values()].filter((row) => row.off?.status !== "rate_limited").length,
      total: 100, reason: "source_rate_limit", promoted: 0 }));
    process.exit(0);
  }
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is required for the grounded-search phase");
  const ai = new GoogleGenAI({ apiKey });
  const pending = baseline.selected.filter((row) => {
    const attempt = attempts.get(row.id);
    return attempt?.off && attempt.off.status !== "assessable" && !attempt.google;
  });
  let next = 0, completed = 0;
  await Promise.all(Array.from({ length: Math.min(3, pending.length) }, async () => {
    while (next < pending.length) {
      const row = pending[next++];
      const attempt = attempts.get(row.id)!;
      attempt.google = await searchExactPage(ai, row); attempts.set(row.id, attempt); completed++;
      await saveCheckpoint();
      if (completed % 10 === 0) console.log(JSON.stringify({ phase: "google", completed, total: pending.length }));
    }
  }));
  console.log(JSON.stringify({ completed: attempts.size, googleCompleted: [...attempts.values()].filter((row) => row.google).length, promoted: 0 }));
} else if (mode === "report") {
  const baseline = await json<Baseline>(`${dir}/baseline.json`);
  const checkpoint = await json<Checkpoint>(`${dir}/checkpoint.json`);
  const attempts = new Map(checkpoint.attempts.map((row) => [row.id, row]));
  const outcomes = baseline.selected.map((row) => {
    const attempt = attempts.get(row.id) || { id: row.id };
    const accepted = attempt.off?.status === "assessable" ? attempt.off.evidence : attempt.google?.status === "assessable" ? attempt.google.evidence : null;
    const assessment = accepted ? assess(accepted) : null;
    return { ...row, ...attempt, result: assessment ? { status: assessment.status, score: assessment.score, scoreRange: assessment.scoreRange,
      missing: assessment.missing, category: assessment.category } : null };
  });
  const report = {
    checkedAt: new Date().toISOString(), baselineCommit: baseline.commit, selected: baseline.selected.length,
    attemptedOff: outcomes.filter((row) => row.off).length, attemptedGoogle: outcomes.filter((row) => row.google).length,
    offAssessable: outcomes.filter((row) => row.off?.status === "assessable").length,
    googleAssessable: outcomes.filter((row) => row.google?.status === "assessable").length,
    exactButIncomplete: outcomes.filter((row) => row.off?.status === "exact_but_incomplete" || row.google?.status === "exact_but_incomplete").length,
    unreviewedSourceDiscoveries: outcomes.filter((row) => row.google?.status === "unreviewed_source").length,
    newlyAssessable: outcomes.filter((row) => row.off?.status === "assessable" || row.google?.status === "assessable").length,
    byCohort: Object.fromEntries(["no_evidence", "one_blocker"].map((cohort) => [cohort, {
      selected: outcomes.filter((row) => row.cohort === cohort).length,
      newlyAssessable: outcomes.filter((row) => row.cohort === cohort && (row.off?.status === "assessable" || row.google?.status === "assessable")).length
    }])),
    discoveredHosts: Object.fromEntries([...new Set(outcomes.map((row) => row.google?.sourceHost).filter((host): host is string => Boolean(host)))].sort()
      .map((host) => [host, outcomes.filter((row) => row.google?.sourceHost === host).length])),
    promoted: 0, outcomes
  };
  await atomic(`${dir}/impact.json`, report);
  console.log(JSON.stringify({ ...report, outcomes: undefined }));
} else throw new Error("Use plan, run or report");
