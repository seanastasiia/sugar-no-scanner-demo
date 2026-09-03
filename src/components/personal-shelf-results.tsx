"use client";

import { useEffect, useState, type ReactNode } from "react";
import { hasContradictoryShelfNutrition, hasSafeShelfSource, rankPersonalShelfProducts, SHELF_MODEL_VERSION, type ShelfEvidence } from "@/lib/personal-shelf-rank";
import type { ProductRecord } from "@/lib/types";
import styles from "./personal-shelf-results.module.css";

export function ShelfRankToggle({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <div className={styles.mode}>
      <button type="button" role="switch" aria-checked={enabled} aria-describedby="shelf-pilot-help" onClick={() => onChange(!enabled)}>
        <span>Personal Shelf Rank <small>Pilot</small></span>
        <span aria-hidden="true" className={`${styles.switch} ${enabled ? styles.switchOn : ""}`}><span /></span>
      </button>
      <p id="shelf-pilot-help">{enabled ? "Camera markers keep the original Sugar + Protein Fit." : "Compare sugar, protein and composition. Original Fit stays available."}</p>
    </div>
  );
}

export function PersonalShelfResults({ products, unidentifiedCount, thumbnail, context = "scan" }: {
  products: ProductRecord[];
  unidentifiedCount: number;
  thumbnail: (id: string) => ReactNode;
  context?: "scan" | "demo";
}) {
  const [managed, setManaged] = useState<Record<string, ShelfEvidence>>({});
  const ids = JSON.stringify([...new Set(products.map((p) => p.id).filter((id) => /^(?:barbora:[a-z0-9-]+|livinn_lt:[A-Za-z0-9._~-]+|off:\d{8,14})$/.test(id)))].sort());
  useEffect(() => {
    // The catalog demo is a fixed example, without a camera or background data calls.
    if (context === "demo" || ids === "[]") return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    // This only runs when the owner opens the pilot; never delay the camera or legacy Fit.
    void fetch("/api/personal-shelf", {
      method: "POST", headers: { "content-type": "application/json" }, body: `{"ids":${ids}}`, signal: controller.signal
    }).then(async (response) => {
      if (response.ok && !controller.signal.aborted) {
        const body = await response.json() as { evidence?: Record<string, ShelfEvidence> };
        if (body.evidence && !controller.signal.aborted) setManaged(body.evidence);
      }
    }).catch(() => { /* Keep exact local evidence available on a network failure. */ })
      .finally(() => clearTimeout(timeout));
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [context, ids]);
  const { groups, unsupported } = rankPersonalShelfProducts(products.map((product) => {
    const next = managed[product.id];
    const current = product.shelfEvidence;
    return next?.productId === product.id && (!current || Date.parse(next.checkedAt) > Date.parse(current.checkedAt))
      ? { ...product, shelfEvidence: next } : product;
  }));
  return (
    <section className={styles.results} aria-label="Personal Shelf Rank results">
      <p className={styles.intro}>Within-type comparison · Pilot preferences, not a health rating.</p>
      {!groups.length ? <p>No supported product types in this scan yet. This pilot covers chips, crackers, spoonable yogurts, dairy desserts, snack bars and cookies.</p> : null}
      {groups.map((group) => (
        <section key={group.category} aria-labelledby={`shelf-group-${group.category}`}>
          <h3 id={`shelf-group-${group.category}`}>{group.label}</h3>
          <p className={styles.groupNote}>{group.scoredCount} of {group.total} scorable in this {context}{group.scoredCount < 2 ? ". Need two for a relative rank." : ". Equal scores share a place."}</p>
          <ul className={styles.list}>
            {group.entries.map(({ product, assessment, rank, tied }) => {
              const evidence = product.shelfEvidence?.productId === product.id && (!product.gtin || !product.shelfEvidence.gtin || product.gtin === product.shelfEvidence.gtin) ? product.shelfEvidence : null;
              return (
                <li className={styles.card} key={product.id}>
                  <div className={styles.heading}>
                    <div className={styles.thumb} aria-hidden="true">{thumbnail(product.id)}</div>
                    <div><small>{product.brand}</small><h4>{product.shortName}</h4></div>
                  </div>
                  <div className={styles.scoreRow}>
                    {assessment.score !== null ? <>
                      <strong>{assessment.score}<span>/100</span></strong>
                      <span>{rank ? `${tied ? "Tied " : ""}#${rank} of ${group.scoredCount} in ${group.label.toLowerCase()}` : `Score only · ${group.label}`}</span>
                    </> : <strong className={styles.unknown}>{assessment.status === "unsupported" ? "Outside this pilot" : "Not enough verified data"}</strong>}
                  </div>
                  {assessment.score !== null ? <>
                    <ul className={styles.reasons}>{assessment.reasons.slice(0, 2).map((reason) => <li key={reason}>{reason}</li>)}</ul>
                    <p className={styles.tradeoff}><b>Consider:</b> {assessment.tradeoffs[0]}</p>
                  </> : <p className={styles.tradeoff}>{assessment.status === "unsupported" ? "Only solid products with per-100 g evidence are compared in v1." : `Missing or unverified: ${assessment.missing.join(", ")}. No score or rank is assigned.`}</p>}
                  <details className={styles.details}>
                    <summary>{assessment.score !== null ? "Why this score?" : "View available evidence"}</summary>
                    {assessment.reasons[2] ? <p>{assessment.reasons[2]}</p> : null}
                    {assessment.components.length ? <dl className={styles.breakdown}>{assessment.components.map((part) => <div key={part.key}><dt>{part.label}</dt><dd>{part.points} / {part.weight} points</dd></div>)}</dl> : null}
                    {assessment.cap ? <p>{assessment.cap}</p> : null}
                    {assessment.tradeoffs.length > 1 ? <ul>{assessment.tradeoffs.slice(1).map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
                    {evidence ? <>
                      {hasContradictoryShelfNutrition(evidence) ? <p><b>Source table is inconsistent. These original values are retained for checking, not trusted nutrition.</b></p> : null}
                      <p>Per {evidence.nutritionBasis === "100ml" ? "100 ml" : "100 g"}: {[
                        ["Energy", evidence.energyKcal, "kcal"], ["Protein", evidence.proteinG, "g"], ["Sugar", evidence.totalSugarG, "g"],
                        ["Carbohydrate", evidence.carbohydrateG, "g"], ["Fat", evidence.fatG, "g"],
                        ["Fiber", evidence.fiberG, "g"], ["Salt", evidence.saltG, "g"], ["Saturated fat", evidence.saturatedFatG, "g"]
                      ].filter(([, value]) => value !== null && value !== undefined).map(([label, value, unit]) => `${label} ${value}${unit}`).join(" · ")}</p>
                      <p><b>Original ingredients ({evidence.ingredientsLanguage || "language unknown"})</b></p>
                      <p lang={evidence.ingredientsLanguage || undefined}>{evidence.ingredientsText || "Not available from this source"}</p>
                      {hasSafeShelfSource(evidence) ? <a href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer">Open exact source</a> : null}
                      <p>Checked {evidence.checkedAt.slice(0, 10)} · {evidence.source === "open_food_facts" ? "Open Food Facts community record (ODbL)" : "Retailer product page"}. Check the package for recipe changes and allergens.</p>
                    </> : <p>Original Sugar + Protein Fit is still available. This pilot requires a separate, dated ingredient and nutrient record for this exact SKU.</p>}
                    <p className={styles.model}>Model {SHELF_MODEL_VERSION}. Weights are a product hypothesis. A shorter ingredient list, E-number count and price do not improve or reduce this score. Total sugars are measured; added/free sugar grams are not inferred.</p>
                    <p className={styles.model}>Score is fixed for the product and model version, not a shelf percentile. Category position depends on the products in this comparison. Ties use competition ranking (1, 1, 3).</p>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {unsupported.length || unidentifiedCount ? <div className={styles.unranked}>
        <h3>Not compared in this pilot</h3>
        <ul>{unsupported.map(({ product }) => <li key={product.id}>{product.brand} {product.shortName}</li>)}</ul>
        {unidentifiedCount ? <p>{unidentifiedCount} product(s) still need an exact identity or nutrient source.</p> : null}
        <p>Use the original Fit mode to view available information.</p>
      </div> : null}
    </section>
  );
}
