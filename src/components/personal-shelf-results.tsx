"use client";

import { useEffect, useState, type ReactNode } from "react";
import { rankPersonalShelfProducts, shelfScoreLabel, type ShelfEvidence } from "@/lib/personal-shelf-rank";
import { personalShelfFit } from "@/lib/personal-shelf-fit";
import type { ProductRecord } from "@/lib/types";
import { PersonalShelfFitBadge } from "./personal-shelf-fit-badge";
import styles from "./personal-shelf-results.module.css";

export function ShelfRankToggle({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <div className={styles.mode}>
      <button type="button" role="switch" aria-checked={enabled} onClick={() => onChange(!enabled)}>
        <span>Personal Shelf Rank <small>Pilot</small></span>
        <span aria-hidden="true" className={`${styles.switch} ${enabled ? styles.switchOn : ""}`}><span /></span>
      </button>
    </div>
  );
}

export function PersonalShelfResults({ products, thumbnail, context = "scan" }: {
  products: ProductRecord[];
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
  const { groups } = rankPersonalShelfProducts(products.map((product) => {
    const next = managed[product.id];
    const current = product.shelfEvidence;
    return next?.productId === product.id && (!current || Date.parse(next.checkedAt) > Date.parse(current.checkedAt))
      ? { ...product, shelfEvidence: next } : product;
  }));
  const ratedGroups = groups.map((group) => ({
    ...group,
    entries: group.entries.filter(({ assessment }) => shelfScoreLabel(assessment) !== null)
  })).filter((group) => group.entries.length > 0);
  const ratedEntries = ratedGroups.flatMap((group) => group.entries.map((entry) => ({ ...entry, group })));
  return (
    <section className={styles.results} aria-label="Personal Shelf Rank results">
      {ratedEntries.length ? <>
        <header className={styles.resultsHeader}>
          <h2>{ratedEntries.length === 1 ? "Best product" : "Best products"}</h2>
          <p className={styles.criteria}>Sugar · Protein · Ingredients · Salt · Saturated fat · Fiber</p>
          <details className={styles.method}>
            <summary>How scores work</summary>
            <div>
              <p>Scores compare products within the same category using sugar, protein, the ingredient base and nutrient balance.</p>
              <p>Great 75–100 · Moderate 50–74 · Low 0–49. Missing facts stay unknown. This is a preference score, not a health rating.</p>
            </div>
          </details>
        </header>
        <div className={styles.groups}>
          {ratedGroups.map((group) => <section className={styles.group} key={group.category} aria-label={group.label}>
            <ol className={styles.list}>
              {group.entries.map(({ product, assessment, rank, tied, rankProvisional }) => {
                const scoreLabel = shelfScoreLabel(assessment);
                const fit = personalShelfFit(assessment);
                const evidence = product.shelfEvidence;
                const reason = assessment.tradeoffs[0] || assessment.reasons[0];
                const rankText = rank ? `${rankProvisional ? "Provisional " : tied ? "Tied " : ""}#${rank} of ${group.scoredCount}` : null;
                return (
                  <li className={styles.card} key={product.id} data-personal-fit={fit?.tone}>
                    <div className={styles.heading}>
                      <div className={styles.thumb} aria-hidden="true">{thumbnail(product.id)}</div>
                      <div className={styles.identity}>
                        <p className={styles.eyebrow}><span>{group.label}</span><span>{product.brand}</span></p>
                        <h3>{product.shortName}</h3>
                      </div>
                    </div>
                    <div className={styles.scoreRow}>
                      {scoreLabel !== null ? <>
                        <strong aria-label={assessment.status === "provisional" ? `Provisional score ${scoreLabel} out of 100` : `Score ${scoreLabel} out of 100`}>{scoreLabel}<span>/100</span></strong>
                        <PersonalShelfFitBadge fit={fit} />
                        {rankText ? <span className={styles.rankLabel} aria-label={`${rankProvisional ? "Provisional " : tied ? "Tied " : ""}rank ${rank} of ${group.scoredCount} in ${group.label}`}>{rankText}</span> : null}
                      </> : <span className={styles.unknown} role="img" aria-label="Not scored">—</span>}
                    </div>
                    {scoreLabel !== null && evidence ? <div className={styles.metrics} aria-label="Nutrition per 100 grams">
                      <span><small>Sugar</small><b>{evidence.totalSugarG} g</b></span>
                      <span><small>Protein</small><b>{evidence.proteinG} g</b></span>
                      <small className={styles.basis}>per 100 g</small>
                    </div> : null}
                    {reason ? <p className={styles.reason}><b>Why?</b><span>{reason}</span></p> : null}
                  </li>
                );
              })}
            </ol>
          </section>)}
        </div>
      </> : <p className={styles.empty}>No rated products in this scan.</p>}
    </section>
  );
}
