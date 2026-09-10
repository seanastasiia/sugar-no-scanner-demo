"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Candy, ChevronDown, Dumbbell, Leaf, Scale, ShieldCheck, Sparkles } from "lucide-react";
import {
  PERSONAL_SHELF_THRESHOLDS,
  rankPersonalShelfProducts,
  SHELF_CATEGORIES,
  shelfScoreLabel,
  type ShelfComponentKey,
  type ShelfEvidence
} from "@/lib/personal-shelf-rank";
import { shelfEvidencePer100g } from "@/lib/personal-shelf-basis-conversion";
import { personalShelfFit } from "@/lib/personal-shelf-fit";
import type { ProductRecord } from "@/lib/types";
import { PersonalShelfFitBadge } from "./personal-shelf-fit-badge";
import styles from "./personal-shelf-results.module.css";

function componentWeightRange(key: ShelfComponentKey): string {
  const weights = Object.values(SHELF_CATEGORIES).map((category) => category.weights[key]);
  return `${Math.min(...weights)}–${Math.max(...weights)}`;
}

const compactComponentLabels: Record<ShelfComponentKey, string> = {
  sugar: "Sugar",
  protein: "Protein",
  composition: "Ingredients",
  balance: "Balance"
};

function compactPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

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

export function PersonalShelfResults({ products, thumbnail, context = "scan", headingLevel = "h2" }: {
  products: ProductRecord[];
  thumbnail: (id: string) => ReactNode;
  context?: "scan" | "demo";
  headingLevel?: "h1" | "h2";
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
  const ResultsHeading = headingLevel;
  const MethodHeading = headingLevel === "h1" ? "h2" : "h3";
  return (
    <section className={styles.results} aria-label="Personal Shelf Rank results">
      {ratedEntries.length ? <>
        <header className={styles.resultsHeader}>
          <ResultsHeading>{ratedEntries.length === 1 ? "Best product" : "Best products"}</ResultsHeading>
          <p className={styles.criteria}>Sugar · Protein · Ingredients · Salt · Saturated fat · Fiber</p>
          <details className={styles.method}>
            <summary>
              <span className={styles.methodSummaryIcon} aria-hidden="true"><Sparkles /></span>
              <span className={styles.methodSummaryCopy}>
                <strong>How scores work</strong>
                <small>Signals, limits and missing data</small>
              </span>
              <span className={styles.methodChevron} aria-hidden="true"><ChevronDown /></span>
            </summary>
            <div className={styles.methodPanel}>
              <header className={styles.methodHero} data-method-intro>
                <MethodHeading className={styles.methodIntro}>Up to 100 points, shaped around your priorities.</MethodHeading>
                <p>We compare only products of the same type. The mix changes by category.</p>
              </header>
              <ul className={styles.methodSignals}>
                <li data-signal="sugar">
                  <span className={styles.methodSignalIcon} aria-hidden="true"><Candy /></span>
                  <div>
                    <span className={styles.methodSignalHeading}>
                      <strong>Sugar</strong>
                      <small>{componentWeightRange("sugar")} pts</small>
                    </span>
                    <span>
                    Full signal at {PERSONAL_SHELF_THRESHOLDS.sugar.fullAtOrBelowG} g per 100 g or less; zero at {PERSONAL_SHELF_THRESHOLDS.sugar.zeroAtOrAboveG} g or more.
                    </span>
                  </div>
                </li>
                <li data-signal="protein">
                  <span className={styles.methodSignalIcon} aria-hidden="true"><Dumbbell /></span>
                  <div>
                    <span className={styles.methodSignalHeading}>
                      <strong>Protein</strong>
                      <small>{componentWeightRange("protein")} pts</small>
                    </span>
                    <span>
                    Calculated as a share of energy: protein g × {PERSONAL_SHELF_THRESHOLDS.protein.kcalPerGram} ÷ kcal × 100. {PERSONAL_SHELF_THRESHOLDS.protein.fullAtEnergyPercent}% or more gets the full signal; below {PERSONAL_SHELF_THRESHOLDS.protein.calloutBelowEnergyPercent}% is called out in the product explanation.
                    </span>
                  </div>
                </li>
                <li data-signal="ingredients">
                  <span className={styles.methodSignalIcon} aria-hidden="true"><Leaf /></span>
                  <div>
                    <span className={styles.methodSignalHeading}>
                      <strong>Ingredients</strong>
                      <small>{componentWeightRange("composition")} pts</small>
                    </span>
                    <span>
                    The first recipe-defining ingredient sets the food-base score. Whole-food bases score higher; refined flour, starch and isolates score lower. Sugar, honey or syrup in the first three ingredients caps this signal at 40%. Sweeteners are disclosed without a safety penalty.
                    </span>
                  </div>
                </li>
                <li data-signal="balance">
                  <span className={styles.methodSignalIcon} aria-hidden="true"><Scale /></span>
                  <div>
                    <span className={styles.methodSignalHeading}>
                      <strong>Balance</strong>
                      <small>{componentWeightRange("balance")} pts</small>
                    </span>
                    <span>
                    Salt scores from full at ≤{PERSONAL_SHELF_THRESHOLDS.salt.fullAtOrBelowG} g to zero at ≥{PERSONAL_SHELF_THRESHOLDS.salt.zeroAtOrAboveG} g. Saturated fat scores from full at ≤{PERSONAL_SHELF_THRESHOLDS.saturatedFat.fullAtOrBelowG} g to zero at ≥{PERSONAL_SHELF_THRESHOLDS.saturatedFat.zeroAtOrAboveG} g. Where relevant, fiber reaches full credit at {PERSONAL_SHELF_THRESHOLDS.fiber.fullAtG} g per 100 g.
                    </span>
                  </div>
                </li>
              </ul>
              <div className={styles.methodDataRule}>
                <span aria-hidden="true"><ShieldCheck /></span>
                <p className={styles.methodMissing}>
                  <strong>Unknown stays unknown.</strong> We never guess missing facts. Missing required data means no score; missing optional fiber creates a provisional range.
                </p>
              </div>
              <div className={styles.methodBands}>
                <strong>Score bands</strong>
                <div role="list" aria-label="Personal Fit score bands">
                  <span role="listitem" data-band="great"><i />Great 75–100</span>
                  <span role="listitem" data-band="moderate"><i />Moderate 50–74</span>
                  <span role="listitem" data-band="low"><i />Low 0–49</span>
                </div>
              </div>
              <p className={styles.methodDisclaimer}>This is a preference score, not a health rating.</p>
            </div>
          </details>
        </header>
        <div className={styles.groups}>
          {ratedGroups.map((group) => <section className={styles.group} key={group.category} aria-label={group.label}>
            <ol className={styles.list}>
              {group.entries.map(({ product, assessment, rank, tied, rankProvisional }) => {
                const evidence = product.shelfEvidence ? shelfEvidencePer100g(product.shelfEvidence) : null;
                const balanceWeights = assessment.category ? SHELF_CATEGORIES[assessment.category].balance : null;
                const scoreLabel = shelfScoreLabel(assessment);
                const fit = personalShelfFit(assessment);
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
                    {assessment.components.length ? <details className={styles.explanation} data-score-breakdown={assessment.status}>
                      <summary aria-label={assessment.status === "provisional" ? "Provisional score breakdown" : "Score breakdown"}>
                        <span className={styles.explanationLabel}>Why this score</span>
                        <span className={styles.explanationChevron} aria-hidden="true"><ChevronDown /></span>
                      </summary>
                      <div className={styles.breakdown}>
                        <p>Points by criterion</p>
                        <div className={styles.breakdownGrid} role="list" aria-label="Points by criterion">
                          {assessment.components.map((component) => {
                            const awarded = component.maxPoints !== undefined && component.maxPoints > component.points
                              ? `${compactPoints(component.points)}–${compactPoints(component.maxPoints)}`
                              : compactPoints(component.points);
                            const label = compactComponentLabels[component.key];
                            return <span
                              className={styles.breakdownItem}
                              data-score-component={component.key}
                              key={component.key}
                              role="listitem"
                              aria-label={`${label}: ${awarded} of ${component.weight} points`}
                            >
                              <small>{label}</small>
                              <b>{awarded}<span> / {component.weight} points</span></b>
                            </span>;
                          })}
                        </div>
                        <div className={styles.facts}>
                          <h4>Nutrition per 100 g</h4>
                          {evidence ? <>
                            <dl className={styles.nutritionGrid}>
                              {([
                                ["Sugar", evidence.totalSugarG, "g"], ["Protein", evidence.proteinG, "g"],
                                ["Salt", evidence.saltG, "g"], ["Saturated fat", evidence.saturatedFatG, "g"],
                                ["Fiber", evidence.fiberG, "g"], ["Energy", evidence.energyKcal, "kcal"]
                              ] as const).map(([label, value, unit]) => <div key={label}>
                                <dt>{label}</dt><dd>{value === null ? "Not listed" : `${value > 0 && value < 0.01 ? "<0.01" : Number(value.toFixed(2))} ${unit}`}</dd>
                              </div>)}
                            </dl>
                            {product.shelfEvidence?.nutritionBasis === "100ml" ? <p>Converted from 100 ml using the exact pack’s declared weight and volume.</p> : null}
                          </> : <p>Nutrition per 100 g is unavailable.</p>}
                          <h4>What Balance means</h4>
                          <p>{balanceWeights?.fiber ? "Less salt and saturated fat, more fiber." : "Less salt and saturated fat. Fiber is not part of this category’s score."} These signals make up the Balance points, with weights set for this product category.</p>
                          <h4>Ingredients on the label</h4>
                          <p className={styles.ingredientText} lang={product.shelfEvidence?.ingredientsLanguage || undefined}>{product.shelfEvidence?.ingredientsText || "Not listed"}</p>
                          <p>{assessment.reasons.find(reason => reason.startsWith("First ingredient:"))}. Ingredients points reflect the food base and sugar near the start of the list, not a safety rating of every ingredient.</p>
                          <div className={styles.scoreNotes}>
                            <h4>What affects this score</h4>
                            <ul>{assessment.tradeoffs.map(note => <li key={note}>{note}</li>)}</ul>
                            {assessment.cap ? <p>{assessment.cap}</p> : null}
                          </div>
                        </div>
                      </div>
                    </details> : null}
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
