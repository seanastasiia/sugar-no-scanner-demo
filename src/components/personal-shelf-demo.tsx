"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Camera, Package } from "lucide-react";
import { useState } from "react";
import type { ScoredProduct } from "@/lib/types";
import { PersonalShelfResults } from "./personal-shelf-results";
import styles from "./personal-shelf-demo.module.css";

function DemoPackshot({ product }: { product: ScoredProduct }) {
  const [failed, setFailed] = useState(false);
  return product.imageUrl && !failed ? (
    <Image className={styles.packshot} src={product.imageUrl} alt="" width={48} height={60} unoptimized
      onError={() => setFailed(true)} data-testid="demo-packshot" />
  ) : <span className={styles.noPackshot} data-testid="demo-packshot-unavailable"><Package aria-hidden="true" size={24} /></span>;
}

export function PersonalShelfDemo({ products }: { products: ScoredProduct[] }) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} href="/" prefetch={false}><ArrowLeft aria-hidden="true" size={18} /> Back to scanner</Link>
        <p className={styles.eyebrow}>Sugar.no · Personal Shelf Rank</p>
        <h1>New rating demo</h1>
        <p className={styles.caption}>Selected catalog examples, not a live scan.</p>
        <p>Here are 5 real products. Compare chips with chips and yogurts with yogurts. Open <b>Why this score?</b> to see the ingredients, nutrition and points.</p>
      </header>
      <section aria-labelledby="demo-results-title">
        <h2 id="demo-results-title" className={styles.resultsTitle}>Your example shelf</h2>
        <PersonalShelfResults products={products} unidentifiedCount={0} context="demo"
          thumbnail={(id) => {
            const product = products.find((item) => item.id === id);
            return product ? <DemoPackshot product={product} /> : null;
          }} />
      </section>
      <footer className={styles.footer}>
        <p>One chip has an inconsistent source table, so it has no score. The other products keep their real scores. This selected example is not a market-wide ranking or a health guarantee.</p>
        <Link className={styles.scan} href="/" prefetch={false}><Camera aria-hidden="true" size={20} /> Scan your own shelf</Link>
        <p className={styles.note}>The scanner opens separately. Enable Personal Shelf Rank in View all to use it on your own results.</p>
      </footer>
    </main>
  );
}
