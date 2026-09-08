"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Package } from "lucide-react";
import { useState } from "react";
import type { ProductRecord, ScoredProduct } from "@/lib/types";
import { PersonalShelfResults } from "./personal-shelf-results";
import styles from "./personal-shelf-demo.module.css";

function DemoPackshot({ product }: { product: ProductRecord }) {
  const [failed, setFailed] = useState(false);
  return product.imageUrl && !failed ? (
    <Image
      className={styles.packshot}
      src={product.imageUrl}
      alt=""
      width={52}
      height={60}
      unoptimized
      onError={() => setFailed(true)}
      data-testid="demo-packshot"
    />
  ) : (
    <span className={styles.noPackshot} data-testid="demo-packshot-unavailable">
      <Package aria-hidden="true" size={24} />
    </span>
  );
}

export function PersonalShelfDemo({ products }: { products: ScoredProduct[] }) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Image
          className={styles.wordmark}
          src="/brand/sugar-no-logo-white.svg"
          alt="Sugar.no"
          width={137}
          height={26.07}
          unoptimized
        />
        <Link className={styles.back} href="/" prefetch={false} aria-label="Back to scanner">
          <ChevronDown aria-hidden="true" size={22} />
        </Link>
      </header>
      <p className={styles.modeLabel}>
        <strong>Personal Shelf Rank</strong>
        <span className={styles.demoBadge}>Demo</span>
      </p>
      <div className={styles.content}>
        <PersonalShelfResults
          context="demo"
          headingLevel="h1"
          products={products}
          thumbnail={(id) => {
            const product = productsById.get(id);
            return product ? <DemoPackshot product={product} /> : null;
          }}
        />
      </div>
    </main>
  );
}
