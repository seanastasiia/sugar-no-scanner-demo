"use client";

import Image from "next/image";
import { ArrowUpRight, Check, Info, LoaderCircle, ScanLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { rankAvailableBetterAlternatives } from "@/lib/better-alternatives";
import { matchCriteria, overlayMatchPresentation, type MatchTone } from "@/lib/match-presentation";
import { barboraProductSlug, isExactOnlineSaving } from "@/lib/online-offer";
import type { ProductDetection, RetailerOffer, ScoredProduct } from "@/lib/types";
import styles from "./scanner-app.module.css";

export interface ProductPayload {
  product: ScoredProduct;
  alternatives: ScoredProduct[];
}

interface AlternativeOfferResponse {
  offers: Record<string, RetailerOffer | null>;
}

function toneClass(tone: MatchTone) {
  if (tone === "strong") return styles.toneStrong;
  if (tone === "middle") return styles.toneMiddle;
  if (tone === "lower") return styles.toneLower;
  return styles.tonePending;
}

export function ProductResult({
  payload,
  detection,
  scanDetections,
  showSummary,
  onAlternative,
  onRetailer
}: {
  payload: ProductPayload;
  detection?: ProductDetection;
  scanDetections: Record<string, ProductDetection>;
  showSummary: boolean;
  onAlternative: (id: string) => void;
  onRetailer: (id: string) => void;
}) {
  const { product, alternatives } = payload;
  const alternativeSlugs = useMemo(
    () => alternatives.map((alternative) => barboraProductSlug(alternative.retailerUrl)).filter(Boolean) as string[],
    [alternatives]
  );
  const offerRequestKey = alternativeSlugs.join("|");
  const [offerResult, setOfferResult] = useState<{
    key: string;
    offers: Record<string, RetailerOffer | null>;
  }>({ key: "", offers: {} });

  useEffect(() => {
    if (!offerRequestKey) return;
    const controller = new AbortController();
    void fetch("/api/offers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slugs: alternativeSlugs }),
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Alternative prices unavailable");
        return response.json() as Promise<AlternativeOfferResponse>;
      })
      .then((response) => setOfferResult({ key: offerRequestKey, offers: response.offers }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setOfferResult({ key: offerRequestKey, offers: {} });
        }
      });
    return () => controller.abort();
  }, [alternativeSlugs, offerRequestKey]);

  const alternativeOffers = useMemo(
    () => (offerResult.key === offerRequestKey ? offerResult.offers : {}),
    [offerRequestKey, offerResult]
  );
  const availableAlternatives = useMemo(
    () =>
      offerResult.key === offerRequestKey
        ? rankAvailableBetterAlternatives(product, alternatives, alternativeOffers, (candidate) =>
            barboraProductSlug(candidate.retailerUrl)
          )
        : [],
    [alternativeOffers, alternatives, offerRequestKey, offerResult.key, product]
  );
  return (
    <article className={styles.productResult}>
      {showSummary ? (
        <div className={styles.productHeading}>
          <div>
            <p className={styles.productBrand}>{product.brand}</p>
            <h2>{product.shortName}</h2>
          </div>
        </div>
      ) : null}

      {detection?.shelfPrice ? (
        <PriceComparison detection={detection} onRetailer={() => onRetailer(product.id)} />
      ) : null}

      {showSummary && product.ratingSignalCount > 0 ? <SugarNoBadge product={product} /> : null}

      {showSummary && product.ratingStatus === "identity_only" ? (
        <div className={styles.pendingDataAction}>
          <Info aria-hidden="true" size={18} />
          <span>
            <strong>Nutrition not verified online</strong>
            Sugar.no checked its catalog, connected Latvia retailers, Open Food Facts and cited web results, but will not invent a fit without an exact per-100 source.
          </span>
        </div>
      ) : null}

      {showSummary && product.noAddedSugarClaim ? (
        <div className={styles.claimBadge}>
          <Check aria-hidden="true" size={15} /> No added sugar claim on source label
        </div>
      ) : null}

      {availableAlternatives.length ? (
        <section className={styles.alternatives} aria-labelledby={`alternatives-${product.id}`}>
          <div className={styles.sectionHeading}>
            <div>
              <p>Better alternatives</p>
              <h3 id={`alternatives-${product.id}`}>Same product type · equal or better fit</h3>
            </div>
          </div>
          <div className={styles.alternativeList}>
            {availableAlternatives.map((alternative) => {
              const slug = barboraProductSlug(alternative.retailerUrl);
              const offer = slug ? alternativeOffers[slug] : null;
              if (!slug || !offer) return null;
              const shelfPrice = scanDetections[alternative.id]?.shelfPrice;
              const cheaperOnline = isExactOnlineSaving(offer, shelfPrice);
              return (
                <article className={styles.alternativeCard} key={alternative.id}>
                  <button
                    className={styles.alternativeOpen}
                    type="button"
                    onClick={() => onAlternative(alternative.id)}
                    aria-label={`Compare ${alternative.name}`}
                  >
                    <div className={styles.alternativeThumb}>
                      {alternative.imageUrl ? (
                        <Image src={alternative.imageUrl} alt="" fill sizes="58px" />
                      ) : null}
                    </div>
                    <span>
                      <small>{alternative.brand}</small>
                      <strong>{alternative.shortName}</strong>
                      <MatchPill product={alternative} />
                    </span>
                  </button>
                  <a
                    className={styles.alternativeBuy}
                    href={offer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onRetailer(alternative.id)}
                    aria-label={`${cheaperOnline ? "Buy cheaper online" : "Buy online"} ${alternative.name} for €${offer.price.toFixed(2)}`}
                  >
                    <span>
                      <strong>{cheaperOnline ? "Cheaper online" : "Buy online"}</strong>
                      {cheaperOnline && shelfPrice ? <s>€{shelfPrice.amount.toFixed(2)} shelf</s> : null}
                    </span>
                    <span className={styles.alternativeBuyPrice}>
                      €{offer.price.toFixed(2)}
                      <ArrowUpRight aria-hidden="true" size={16} />
                    </span>
                  </a>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </article>
  );
}
export function RecognizedProductResult({
  detection,
  onRetailer
}: {
  detection: ProductDetection;
  onRetailer: () => void;
}) {
  const identity = detection.identity!;
  const visiblePackSize =
    identity.packSize && !identity.name.toLowerCase().includes(identity.packSize.toLowerCase())
      ? identity.packSize
      : null;
  return (
    <article className={styles.productResult}>
      <div className={styles.productHeading}>
        <div>
          <p className={styles.productBrand}>{identity.brand || "Recognized package"}</p>
          <h2>{[identity.name, identity.variant, visiblePackSize].filter(Boolean).join(" · ")}</h2>
        </div>
        <span className={styles.recognizedBadge}>
          <ScanLine aria-hidden="true" size={15} /> Identified
        </span>
      </div>

      {detection.shelfPrice ? <PriceComparison detection={detection} onRetailer={onRetailer} /> : null}

      <div className={styles.pendingDataAction}>
        <Info aria-hidden="true" size={18} />
        <span>
          <strong>Nutrition not verified online</strong>
          Sugar.no will not invent protein or sugar values when an exact source cannot be confirmed.
        </span>
      </div>
    </article>
  );
}

export function LoadingProductResult({ detection }: { detection: ProductDetection }) {
  const identity = detection.identity!;
  return (
    <article className={styles.productResult} aria-live="polite">
      <div className={styles.productHeading}>
        <div>
          <p className={styles.productBrand}>{identity.brand || "Recognized package"}</p>
          <h2>{identity.name}</h2>
        </div>
      </div>
      <div className={styles.pendingData}>
        <LoaderCircle className={styles.spin} aria-hidden="true" size={18} />
        <span>
          <strong>Checking nutrition online…</strong>
          Checking the Sugar.no catalog, connected Latvia retailers, Open Food Facts and cited web results.
        </span>
      </div>
    </article>
  );
}

function PriceComparison({ detection, onRetailer }: { detection: ProductDetection; onRetailer: () => void }) {
  const shelfPrice = detection.shelfPrice;
  if (!shelfPrice) return null;
  const isDemoShelfPrice = shelfPrice.observedText.startsWith("Demo shelf price");
  const offer = detection.retailerOffer?.exactSku ? detection.retailerOffer : null;
  const cheaperOnline = Boolean(offer && offer.price < shelfPrice.amount);
  const savings = cheaperOnline && offer ? shelfPrice.amount - offer.price : 0;
  const checkedTime = offer
    ? new Date(offer.checkedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <section
      className={`${styles.priceComparison} ${cheaperOnline ? styles.priceComparisonDeal : ""}`}
      aria-label="Price comparison"
    >
      <div className={styles.priceHeading}>
        <span>{cheaperOnline && offer ? `Cheaper at ${offer.retailer}` : offer ? `${offer.retailer} price check` : "Shelf price"}</span>
        {savings > 0 ? <strong>€{savings.toFixed(2)} less</strong> : null}
      </div>
      <div className={styles.priceValues}>
        <div>
          <small>{isDemoShelfPrice ? "Demo shelf price" : "Scanned shelf label"}</small>
          <strong className={cheaperOnline ? styles.crossedPrice : ""}>€{shelfPrice.amount.toFixed(2)}</strong>
        </div>
        {offer ? (
          <div>
            <small>{offer.retailer} online</small>
            <strong>€{offer.price.toFixed(2)}</strong>
          </div>
        ) : null}
      </div>
      {offer ? (
        <>
          <p>
            {isDemoShelfPrice ? "Demo shelf value · exact product match" : "Matched by package identity"}
            {checkedTime ? ` · checked ${checkedTime}` : ""}
          </p>
          <a
            className={styles.retailerButton}
            href={offer.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onRetailer}
          >
            <span>
              <small>Current online offer</small>
              {cheaperOnline ? `Buy cheaper at ${offer.retailer}` : `View at ${offer.retailer}`} · €{offer.price.toFixed(2)}
            </span>
            <ArrowUpRight aria-hidden="true" size={19} />
          </a>
        </>
      ) : (
        <p>No exact online match. The camera-read shelf price is shown without a retailer link.</p>
      )}
    </section>
  );
}

export function CompactProductPrice({ detection }: { detection?: ProductDetection }) {
  const shelfPrice = detection?.shelfPrice;
  if (!shelfPrice) return null;
  const offer = detection.retailerOffer?.exactSku ? detection.retailerOffer : null;
  const cheaperOnline = Boolean(offer && offer.price < shelfPrice.amount);
  const shelfPriceLabel = shelfPrice.observedText.startsWith("Demo shelf price") ? "Demo shelf price" : "Shelf price";
  const accessibleLabel = cheaperOnline && offer
    ? `${shelfPriceLabel} €${shelfPrice.amount.toFixed(2)}, ${offer.retailer} €${offer.price.toFixed(2)}, cheaper at ${offer.retailer}`
    : `${shelfPriceLabel} €${shelfPrice.amount.toFixed(2)}`;

  return (
    <div className={styles.compactProductPrice} role="group" aria-label={accessibleLabel}>
      {cheaperOnline ? (
        <s className={styles.compactCrossedPrice}>€{shelfPrice.amount.toFixed(2)}</s>
      ) : (
        <span>€{shelfPrice.amount.toFixed(2)}</span>
      )}
      {cheaperOnline && offer ? (
        <>
          <strong>€{offer.price.toFixed(2)}</strong>
          <small>{offer.retailer}</small>
        </>
      ) : (
        <small>shelf</small>
      )}
    </div>
  );
}

function SugarNoBadge({ product }: { product: ScoredProduct }) {
  const presentation = overlayMatchPresentation(product);
  const criteria = matchCriteria(product);
  const nutritionSourceLabel = product.ratingBasis.startsWith("catalog_")
    ? "Sugar.no badge"
      : product.ratingBasis.startsWith("barbora_")
      ? "Exact Barbora nutrition"
      : product.ratingBasis.startsWith("retailer_catalog_")
        ? "Connected retailer nutrition"
      : product.ratingBasis.startsWith("open_food_facts_")
        ? "Open Food Facts nutrition"
        : product.ratingBasis.startsWith("web_search_")
          ? "Verified web nutrition"
        : product.ratingBasis.startsWith("manufacturer_")
          ? "Manufacturer nutrition"
          : product.ratingBasis.startsWith("food_composition_")
            ? "Food composition reference"
            : "Source-backed nutrition";
  const values = {
    protein: product.nutrientsPer100g.proteinG,
    sugar: product.nutrientsPer100g.totalSugarG
  };
  return (
    <section className={styles.sugarBadge} aria-label="Sugar.no badge">
      <div className={styles.sugarBadgeHeading}>
        <div>
          <small>{nutritionSourceLabel}</small>
          <strong>
            {product.ratingStatus === "complete" ? "Sugar.no fit" : "Sugar.no limited view · 1/2"}
          </strong>
        </div>
        <span className={toneClass(presentation.tone)}>{presentation.label}</span>
      </div>
      <div className={styles.criteria}>
        {criteria.map((criterion) => (
          <div className={`${styles.criterion} ${toneClass(criterion.tone)}`} key={criterion.key}>
            <i aria-hidden="true" />
            <span>{criterion.label}</span>
            <strong>{values[criterion.key] === null ? "—" : `${values[criterion.key]}g`}</strong>
            <small>{criterion.status}</small>
          </div>
        ))}
      </div>
      <p className={styles.perHundred}>
        {product.ratingBasis === "catalog_percentile" && product.ratingStatus === "complete"
          ? "Values per 100 g · Compared with protein snacks in this demo"
          : `Values per ${product.nutritionBasis === "100ml" ? "100 ml" : "100 g"} · ${product.ratingSignalCount} of 2 source-backed signals`}
      </p>
    </section>
  );
}

export function MatchPill({ product }: { product: ScoredProduct }) {
  const presentation = overlayMatchPresentation(product);
  return (
    <em className={`${styles.matchPill} ${toneClass(presentation.tone)}`}>
      {presentation.label}
      {product.ratingSignalCount > 0 && product.ratingSignalCount < 2 ? ` · ${product.ratingSignalCount}/2` : ""}
    </em>
  );
}
