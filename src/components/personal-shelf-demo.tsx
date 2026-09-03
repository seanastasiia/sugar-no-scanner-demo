"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Package } from "lucide-react";
import { useId, useState } from "react";
import { hasContradictoryShelfNutrition, rankPersonalShelfProducts, shelfScoreLabel } from "@/lib/personal-shelf-rank";
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
  const { product, assessment, rank, tied, rankProvisional } = entry;
  const scoreLabel = shelfScoreLabel(assessment);
  const provisional = assessment.status === "provisional";
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const evidence = product.shelfEvidence?.productId === product.id && (!product.gtin || !product.shelfEvidence.gtin || product.gtin === product.shelfEvidence.gtin) ? product.shelfEvidence : null;
  const inconsistent = hasContradictoryShelfNutrition(evidence);
  return (
    <li className={`${styles.card} ${(rank === 1 && !rankProvisional) || expanded ? styles.emphasized : ""}`}>
      <button type="button" className={styles.row} aria-expanded={expanded} aria-controls={detailId}
        onClick={() => setExpanded(!expanded)} data-testid="demo-product-row">
        <span className={`${styles.rank} ${rank === null ? styles.pending : ""} ${rankProvisional ? styles.provisionalRank : ""}`}
          aria-label={rank === null ? "Unranked" : `${rankProvisional ? "Provisional rank" : tied ? "Tied rank" : "Rank"} ${rank}`}>
          {rank === null ? "–" : `#${rank}`}
        </span>
        <span className={styles.thumb} aria-hidden="true"><DemoPackshot product={product} /></span>
        <span className={styles.copy}>
          <span className={styles.brandRow}><span className={styles.brand}>{product.brand}</span><ChevronDown className={styles.chevron} aria-hidden="true" size={14} /></span>
          <span className={styles.title}>{product.shortName}</span>
          {scoreLabel !== null && evidence ? <>
            <span className={styles.score} aria-label={provisional ? `Provisional score ${assessment.scoreRange!.min} to ${assessment.scoreRange!.max} out of 100, fiber unknown` : `Score ${assessment.score} out of 100`}>{scoreLabel}<span>/100</span></span>
            {provisional || rankProvisional ? <span className={styles.provisional}>{provisional ? "Provisional · fiber unknown" : "Provisional rank"}</span> : null}
            <span className={styles.nutrition}>Protein {evidence.proteinG}g · Sugar {evidence.totalSugarG}g <span>/100 g</span></span>
          </> : <span className={styles.unknown}>Not scored</span>}
        </span>
      </button>
      <div id={detailId} hidden={!expanded} className={styles.details} data-testid="demo-product-details">
        {assessment.components.length ? <dl className={styles.breakdown}>{assessment.components.map((part) => (
          <div key={part.key}><dt>{part.label}</dt><dd>{part.points}{part.maxPoints !== undefined && part.maxPoints !== part.points ? `–${part.maxPoints}` : ""} / {part.weight}</dd></div>
        ))}</dl> : null}
        {assessment.cap ? <p>{assessment.cap}</p> : null}
        {provisional ? <p>Fiber is not listed. This range covers its possible contribution; no fiber value is estimated.</p> : null}
        {rankProvisional ? <p>Provisional order uses the lower score bound. Overlapping ranges do not establish a winner.</p> : null}
        {scoreLabel === null ? <p>{inconsistent ? "Source table is inconsistent. No score assigned." : `Missing or unverified: ${assessment.missing.join(", ") || "exact product evidence"}. No score assigned.`}</p> : null}
      </div>
    </li>
  );
}

export function PersonalShelfDemo({ products }: { products: ScoredProduct[] }) {
  const { groups } = rankPersonalShelfProducts(products);
  const selected = groups.find((group) => group.category === "chips");
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Best fit first</h1>
        <span className={styles.demoBadge}><span aria-hidden="true">Demo</span><span className={styles.srOnly}>Catalog demo, not a live scan</span></span>
        <Link className={styles.back} href="/" prefetch={false} aria-label="Back to scanner"><ChevronDown aria-hidden="true" size={22} /></Link>
      </header>
      <h2 className={styles.category}>Chips</h2>
      {selected ? <section key={selected.category} aria-label={selected.label}>
        <ul className={styles.list}>{selected.entries.map((entry) => <DemoCard key={entry.product.id} entry={entry} />)}</ul>
      </section> : null}
    </main>
  );
}
