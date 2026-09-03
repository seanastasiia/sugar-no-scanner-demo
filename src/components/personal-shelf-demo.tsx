"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Package } from "lucide-react";
import { useId, useState } from "react";
import { hasContradictoryShelfNutrition, hasSafeShelfSource, rankPersonalShelfProducts, SHELF_MODEL_VERSION, type ShelfCategory } from "@/lib/personal-shelf-rank";
import type { ProductRecord, ScoredProduct } from "@/lib/types";
import styles from "./personal-shelf-demo.module.css";

function DemoPackshot({ product }: { product: ProductRecord }) {
  const [failed, setFailed] = useState(false);
  return product.imageUrl && !failed ? (
    <Image className={styles.packshot} src={product.imageUrl} alt="" width={48} height={60} unoptimized
      onError={() => setFailed(true)} data-testid="demo-packshot" />
  ) : <span className={styles.noPackshot} data-testid="demo-packshot-unavailable"><Package aria-hidden="true" size={24} /></span>;
}

type DemoEntry = ReturnType<typeof rankPersonalShelfProducts>["groups"][number]["entries"][number];

function DemoCard({ entry }: { entry: DemoEntry }) {
  const { product, assessment, rank, tied } = entry;
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const evidence = product.shelfEvidence?.productId === product.id && (!product.gtin || !product.shelfEvidence.gtin || product.gtin === product.shelfEvidence.gtin) ? product.shelfEvidence : null;
  const inconsistent = hasContradictoryShelfNutrition(evidence);
  return (
    <li className={`${styles.card} ${rank === 1 || expanded ? styles.emphasized : ""}`}>
      <button type="button" className={styles.row} aria-expanded={expanded} aria-controls={detailId}
        onClick={() => setExpanded(!expanded)} data-testid="demo-product-row">
        <span className={`${styles.rank} ${rank === null ? styles.pending : ""}`}
          aria-label={rank === null ? "Unranked" : `${tied ? "Tied rank" : "Rank"} ${rank}`}>
          {rank === null ? "–" : `#${rank}`}
        </span>
        <span className={styles.thumb} aria-hidden="true"><DemoPackshot product={product} /></span>
        <span className={styles.copy}>
          <span className={styles.brandRow}><span className={styles.brand}>{product.brand}</span><ChevronDown className={styles.chevron} aria-hidden="true" size={14} /></span>
          <span className={styles.title}>{product.shortName}</span>
          {assessment.score !== null && evidence ? <>
            <span className={styles.score} aria-label={`Score ${assessment.score} out of 100`}>{assessment.score}<span>/100</span></span>
            <span className={styles.nutrition}>Protein {evidence.proteinG}g · Sugar {evidence.totalSugarG}g <span>/100 g</span></span>
          </> : <span className={styles.unknown}>Not scored</span>}
        </span>
      </button>
      <div id={detailId} hidden={!expanded} className={styles.details} data-testid="demo-product-details">
        {assessment.components.length ? <dl className={styles.breakdown}>{assessment.components.map((part) => (
          <div key={part.key}><dt>{part.label}</dt><dd>{part.points} / {part.weight}</dd></div>
        ))}</dl> : null}
        {assessment.cap ? <p>{assessment.cap}</p> : null}
        {evidence ? <>
          {inconsistent ? <p>Source table is inconsistent. No score assigned.</p> : <p>Per 100 g: {[
            ["Energy", evidence.energyKcal, "kcal"], ["Protein", evidence.proteinG, "g"], ["Sugar", evidence.totalSugarG, "g"],
            ["Carbohydrate", evidence.carbohydrateG, "g"], ["Fat", evidence.fatG, "g"],
            ["Fiber", evidence.fiberG, "g"], ["Salt", evidence.saltG, "g"], ["Saturated fat", evidence.saturatedFatG, "g"]
          ].filter(([, value]) => value !== null && value !== undefined).map(([label, value, unit]) => `${label} ${value}${unit}`).join(" · ")}</p>}
          <p><b>Original ingredients ({evidence.ingredientsLanguage || "language unknown"})</b></p>
          <p lang={evidence.ingredientsLanguage || undefined}>{evidence.ingredientsText || "Not available from this source"}</p>
          {hasSafeShelfSource(evidence) ? <a href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer">Open exact source</a> : null}
          <p className={styles.note}>Checked {evidence.checkedAt.slice(0, 10)}. Check the package for recipe changes and allergens.</p>
        </> : <p>No verified evidence for this exact product.</p>}
        <p className={styles.note}>Pilot preference score, not a health rating. Model {SHELF_MODEL_VERSION}.</p>
      </div>
    </li>
  );
}

export function PersonalShelfDemo({ products }: { products: ScoredProduct[] }) {
  const [category, setCategory] = useState<ShelfCategory>("chips");
  const { groups } = rankPersonalShelfProducts(products);
  const selected = groups.find((group) => group.category === category) || groups[0];
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Best fit first</h1>
        <span className={styles.demoBadge}><span aria-hidden="true">Demo</span><span className={styles.srOnly}>Catalog demo, not a live scan</span></span>
        <Link className={styles.back} href="/" prefetch={false} aria-label="Back to scanner"><ChevronDown aria-hidden="true" size={22} /></Link>
      </header>
      <fieldset className={styles.categories}>
        <legend className={styles.srOnly}>Product type</legend>
        {groups.map((group) => <label key={group.category}>
          <input className={styles.srOnly} type="radio" name="demo-category" value={group.category}
            checked={selected?.category === group.category} onChange={() => setCategory(group.category)} />
          <span>{group.category === "yogurt" ? "Yogurts" : group.label}</span>
        </label>)}
      </fieldset>
      {selected ? <section key={selected.category} aria-label={selected.label}>
        <ul className={styles.list}>{selected.entries.map((entry) => <DemoCard key={entry.product.id} entry={entry} />)}</ul>
      </section> : null}
    </main>
  );
}
