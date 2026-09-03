"use client";

import { useEffect, useState, type ReactNode } from "react";
import { rankPersonalShelfProducts, shelfScoreLabel, type ShelfEvidence } from "@/lib/personal-shelf-rank";
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

export function PersonalShelfResults({ products, unresolved = [], thumbnail, context = "scan" }: {
  products: ProductRecord[];
  unresolved?: Array<{ id: string; brand: string; name: string; pending: boolean }>;
  thumbnail: (id: string) => ReactNode;
  context?: "scan" | "demo";
}) {
  const [managed, setManaged] = useState<Record<string, ShelfEvidence>>({});
  const ids = JSON.stringify([...new Set(products.map((p) => p.id).filter((id) => /^(?:barbora:[a-z0-9-]+|(?:rimi_lv|livinn_lt):[A-Za-z0-9._~-]+|off:\d{8,14})$/.test(id)))].sort());
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
      {!groups.length && !unsupported.length && !unresolved.length ? <p className={styles.empty}>No products identified yet. Try a closer photo of the shelf.</p> : null}
      {groups.map((group) => (
        <section key={group.category} aria-labelledby={`shelf-group-${group.category}`}>
          <h3 id={`shelf-group-${group.category}`}>{group.label}</h3>
          <ul className={styles.list}>
            {group.entries.map(({ product, assessment, rank, tied, rankProvisional }) => {
              const scoreLabel = shelfScoreLabel(assessment);
              return (
                <li className={styles.card} key={product.id}>
                  <div className={styles.heading}>
                    <div className={styles.thumb} aria-hidden="true">{thumbnail(product.id)}</div>
                    <div><small>{product.brand}</small><h4>{product.shortName}</h4></div>
                  </div>
                  <div className={styles.scoreRow}>
                    {scoreLabel !== null ? <>
                      <strong>{scoreLabel}<span>/100</span>{assessment.status === "provisional" ? <small> Provisional · fiber unknown</small> : null}</strong>
                      <span>{rank ? `${rankProvisional ? "Provisional " : tied ? "Tied " : ""}#${rank} of ${group.scoredCount} in ${group.label.toLowerCase()}` : `Score only · ${group.label}`}</span>
                    </> : <span className={styles.unknown} role="img" aria-label="Not scored">—</span>}
                  </div>
                  {scoreLabel !== null ? <>
                    <ul className={styles.reasons}>{assessment.reasons.slice(0, 2).map((reason) => <li key={reason}>{reason}</li>)}</ul>
                    <p className={styles.tradeoff}><b>Consider:</b> {assessment.tradeoffs[0]}</p>
                  </> : null}
                  {assessment.components.length ? <details className={styles.details}>
                    <summary>Why this score?</summary>
                    {assessment.status === "provisional" ? <p>Fiber is not listed. The range covers its possible point contribution, not estimated grams. Provisional places use the lower bound; overlapping ranges do not establish a winner.</p> : null}
                    {assessment.components.length ? <dl className={styles.breakdown}>{assessment.components.map((part) => <div key={part.key}><dt>{part.label}</dt><dd>{part.points}{part.maxPoints !== undefined && part.maxPoints !== part.points ? `–${part.maxPoints}` : ""} / {part.weight} points</dd></div>)}</dl> : null}
                    {assessment.cap ? <p>{assessment.cap}</p> : null}
                  </details> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {unsupported.length || unresolved.length ? <section aria-labelledby="shelf-unrated-title">
        <h3 id="shelf-unrated-title">More products</h3>
        <ul className={styles.list}>
          {unsupported.map(({ product }) => <li className={styles.card} key={product.id}>
            <div className={styles.heading}>
              <div className={styles.thumb} aria-hidden="true">{thumbnail(product.id)}</div>
              <div><small>{product.brand}</small><h4>{product.shortName}</h4></div>
            </div>
            <p className={styles.empty}>Personal score unavailable</p>
          </li>)}
          {unresolved.map((product) => <li className={styles.card} key={product.id}>
            <div className={styles.heading}>
              <div className={styles.thumb} aria-hidden="true">{thumbnail(product.id)}</div>
              <div><small>{product.brand}</small><h4>{product.name}</h4></div>
            </div>
            <p className={styles.empty} role="status">{product.pending ? "Checking product data…" : "Nutrition not verified"}</p>
          </li>)}
        </ul>
      </section> : null}
    </section>
  );
}
