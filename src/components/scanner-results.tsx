"use client";

import Image from "next/image";
import { ArrowUpRight, Check, Info, LoaderCircle, ScanLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { productDisplayName, productDisplayImage } from "@/lib/product-display";
import { rankAvailableBetterAlternatives } from "@/lib/better-alternatives";
import { matchCriteria, overlayMatchPresentation, type MatchTone } from "@/lib/match-presentation";
import { isExactOnlineSaving, retailerOfferKey } from "@/lib/online-offer";
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
  offer,
  scanDetections,
  showSummary,
  onAlternative,
  onRetailer,
  thumbnail
}: {
  payload: ProductPayload;
  detection?: ProductDetection;
  offer?: RetailerOffer | null;
  scanDetections: Record<string, ProductDetection>;
  showSummary: boolean;
  onAlternative: (id: string) => void;
  onRetailer: (id: string) => void;
  thumbnail?: React.ReactNode;
}) {
  const { product, alternatives } = payload;
  const alternativeOfferKeys = useMemo(
    () => alternatives.map((alternative) => retailerOfferKey(alternative)).filter(Boolean) as string[],
    [alternatives]
  );
  const offerRequestKey = alternativeOfferKeys.join("|");
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
      body: JSON.stringify({ keys: alternativeOfferKeys }),
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
  }, [alternativeOfferKeys, offerRequestKey]);

  const alternativeOffers = useMemo(
    () => (offerResult.key === offerRequestKey ? offerResult.offers : {}),
    [offerRequestKey, offerResult]
  );
  const availableAlternatives = useMemo(
    () =>
      offerResult.key === offerRequestKey
        ? rankAvailableBetterAlternatives(product, alternatives, alternativeOffers, retailerOfferKey)
        : [],
    [alternativeOffers, alternatives, offerRequestKey, offerResult.key, product]
  );
  return (
    <article className={styles.productResult}>
      {showSummary ? (
        <>
          <div className={styles.productSummary}>
            {thumbnail ? (
              <div className={styles.detailImage}>{thumbnail}</div>
            ) : product.imageUrl ? (
              <div className={styles.detailImage}>
                <Image src={product.imageUrl} alt="" fill sizes="320px" />
              </div>
            ) : null}
            <div className={styles.productHeading}>
              <div>
                <p className={styles.productBrand}>{product.brand}</p>
                <h2>{productDisplayName(product)}</h2>
              </div>
            </div>
            <div className={styles.detailTags}>
              {product.ratingSignalCount > 0 ? (
                <MatchPill product={product} />
              ) : (
                <span className={styles.recognizedBadge}>Nutrition not verified</span>
              )}
              {detection?.identity?.packSize || product.packSizeG > 0 ? (
                <span className={styles.packSize}>{detection?.identity?.packSize || `${product.packSizeG} g`}</span>
              ) : null}
            </div>
            {product.ratingSignalCount > 0 ? (
              <SugarNoBadge product={product} />
            ) : (
              <div className={styles.pendingDataAction}>
                <Info aria-hidden="true" size={18} />
                <span>
                  <strong>Nutrition not verified online</strong>We couldn’t confirm an exact source. Sugar and protein
                  stay unknown.
                </span>
              </div>
            )}
            {product.noAddedSugarClaim ? (
              <div className={styles.claimBadge}>
                <Check aria-hidden="true" size={15} />
                No added sugar claim on source label
              </div>
            ) : null}
          </div>
          <ProductDetailOffer
            product={product}
            detection={detection}
            offer={offer}
            onRetailer={() => onRetailer(product.id)}
          />
          {product.sources
            .filter(
              (source) =>
                source.status !== "pending" &&
                source.fields.some((field) => ["protein", "totalSugar", "carbohydrate"].includes(field))
            )
            .slice(0, 1)
            .map((source) => (
              <a
                className={styles.nutritionSource}
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Nutrition source · {source.label.replace(/ (Latvia product page|product page)$/i, "")}
              </a>
            ))}
        </>
      ) : null}

      {availableAlternatives.length ? (
        <section className={styles.alternatives} aria-labelledby={`alternatives-${product.id}`}>
          <div className={styles.sectionHeading}>
            <div>
              <p>Better alternatives</p>
              <h3 id={`alternatives-${product.id}`}>Same product type · Great fit only</h3>
            </div>
          </div>
          <div className={styles.alternativeList}>
            {availableAlternatives.map((alternative) => {
              const offerKey = retailerOfferKey(alternative);
              const offer = offerKey ? alternativeOffers[offerKey] : null;
              if (!offerKey || !offer) return null;
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
                        <Image src={productDisplayImage(alternative)!} alt="" fill sizes="58px" />
                      ) : null}
                    </div>
                    <span>
                      <small>{alternative.brand}</small>
                      <strong>{productDisplayName(alternative)}</strong>
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
                      {cheaperOnline && shelfPrice ? <s>€{shelfPrice.amount.toFixed(2)}</s> : null}
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
export function RecognizedProductResult({ detection }: { detection: ProductDetection }) {
  const identity = detection.identity!;
  const visiblePackSize =
    identity.packSize && !identity.name.toLowerCase().includes(identity.packSize.toLowerCase())
      ? identity.packSize
      : null;
  return (
    <article className={`${styles.productResult} ${styles.productSummary}`}>
      <div className={styles.productHeading}>
        <div>
          <p className={styles.productBrand}>{identity.brand || "Recognized package"}</p>
          <h2>{[identity.name, identity.variant, visiblePackSize].filter(Boolean).join(" · ")}</h2>
        </div>
        <span className={styles.recognizedBadge}>
          <ScanLine aria-hidden="true" size={15} /> Identified
        </span>
      </div>

      <div className={styles.pendingDataAction}>
        <Info aria-hidden="true" size={18} />
        <span>
          <strong>Nutrition not verified</strong>
          Sugar.no will not invent protein or sugar values when an exact source cannot be confirmed.
        </span>
      </div>
    </article>
  );
}

export function LoadingProductResult({ detection }: { detection: ProductDetection }) {
  const identity = detection.identity!;
  return (
    <article className={`${styles.productResult} ${styles.productSummary}`} aria-live="polite">
      <div className={styles.productHeading}>
        <div>
          <p className={styles.productBrand}>{identity.brand || "Recognized package"}</p>
          <h2>{identity.name}</h2>
        </div>
      </div>
      <div className={styles.pendingData}>
        <LoaderCircle className={styles.spin} aria-hidden="true" size={18} />
        <span>
          <strong>Matching product…</strong>
          Checking nutrition from an exact product source.
        </span>
      </div>
      <div className={styles.resultSkeleton} aria-hidden="true" />
      <div className={styles.resultSkeletonShort} aria-hidden="true" />
    </article>
  );
}

export function CompactProductPrice({
  detection,
  offer: offerOverride
}: {
  detection?: ProductDetection;
  offer?: RetailerOffer | null;
}) {
  const shelfPrice = detection?.shelfPrice;
  const offer = offerOverride?.exactSku
    ? offerOverride
    : detection?.retailerOffer?.exactSku
      ? detection.retailerOffer
      : null;
  if (!shelfPrice && !offer) return null;
  const cheaperOnline = Boolean(offer && shelfPrice && offer.price < shelfPrice.amount);
  const shelfPriceLabel = shelfPrice?.observedText.startsWith("Demo shelf price") ? "Demo shelf price" : "Shelf price";
  const accessibleLabel =
    cheaperOnline && offer
      ? `${shelfPriceLabel} €${shelfPrice!.amount.toFixed(2)}, online price €${offer.price.toFixed(2)}, cheaper online`
      : shelfPrice
        ? `${shelfPriceLabel} €${shelfPrice.amount.toFixed(2)}`
        : `Online price €${offer?.price.toFixed(2)}`;

  return (
    <div className={styles.compactProductPrice} role="group" aria-label={accessibleLabel}>
      {shelfPrice ? (
        cheaperOnline ? (
          <s className={styles.compactCrossedPrice}>€{shelfPrice.amount.toFixed(2)}</s>
        ) : (
          <span>€{shelfPrice.amount.toFixed(2)}</span>
        )
      ) : null}
      {cheaperOnline && offer ? (
        <strong>€{offer.price.toFixed(2)}</strong>
      ) : offer ? (
        <strong>€{offer.price.toFixed(2)}</strong>
      ) : null}
    </div>
  );
}

export function OnlineOfferAction({
  productName,
  detection,
  offer: offerOverride,
  onRetailer
}: {
  productName: string;
  detection?: ProductDetection;
  offer?: RetailerOffer | null;
  onRetailer: () => void;
}) {
  const offer = offerOverride?.exactSku
    ? offerOverride
    : detection?.retailerOffer?.exactSku
      ? detection.retailerOffer
      : null;
  const shelfPrice = detection?.shelfPrice;
  if (!offer || !isExactOnlineSaving(offer, shelfPrice)) return null;
  return (
    <a
      className={styles.onlineOfferAction}
      href={offer.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onRetailer}
      aria-label={`Buy cheaper online ${productName} at ${offer.retailer} for €${offer.price.toFixed(2)}`}
    >
      <strong>Buy cheaper online</strong>
      <span className={styles.onlineOfferPrice}>
        {shelfPrice ? <s>€{shelfPrice.amount.toFixed(2)}</s> : null}€{offer.price.toFixed(2)}
      </span>
    </a>
  );
}

function ProductDetailOffer({
  product,
  detection,
  offer: override,
  onRetailer
}: {
  product: ScoredProduct;
  detection?: ProductDetection;
  offer?: RetailerOffer | null;
  onRetailer: () => void;
}) {
  const offer = override?.exactSku ? override : detection?.retailerOffer?.exactSku ? detection.retailerOffer : null;
  if (!offer && !detection?.shelfPrice) return null;
  const cheaper = offer && isExactOnlineSaving(offer, detection?.shelfPrice);
  return (
    <section className={styles.offerSummary} aria-label="Product price">
      <div className={styles.offerSummaryHeading}>
        <span>{cheaper ? "Buy cheaper online" : offer ? "Online price" : "Shelf price"}</span>
        <CompactProductPrice detection={detection} offer={offer} />
      </div>
      {cheaper && offer ? (
        <a
          className={styles.onlineOfferAction}
          style={{ justifyContent: "center" }}
          href={offer.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onRetailer}
          aria-label={`Open retailer for ${productDisplayName(product)} at ${offer.retailer}`}
        >
          Open retailer
        </a>
      ) : null}
    </section>
  );
}

function SugarNoBadge({ product }: { product: ScoredProduct }) {
  const criteria = matchCriteria(product);
  const values = { protein: product.nutrientsPer100g.proteinG, sugar: product.nutrientsPer100g.totalSugarG };
  const carbohydrate = product.nutrientsPer100g.carbohydrateG;
  return (
    <section className={styles.sugarBadge} aria-label="Sugar.no badge">
      <p className={styles.comparisonContext}>
        {product.ratingBasis === "catalog_percentile"
          ? "Compared within protein snacks."
          : product.ratingSignalCount === 2
            ? "Sugar.no fit · exact product data"
            : `Limited view · ${product.ratingSignalCount} of 2 signals verified`}
      </p>
      <div className={styles.criteria}>
        {[...criteria].reverse().map((criterion) => (
          <div className={styles.criterion} key={criterion.key}>
            <span>{criterion.key === "sugar" ? "Sugar" : "Protein"}</span>
            <strong>{values[criterion.key] === null ? "—" : `${values[criterion.key]} g`}</strong>
            {values[criterion.key] === null ? <small>Not verified</small> : null}
          </div>
        ))}
        {carbohydrate !== null && carbohydrate !== undefined ? (
          <div className={styles.criterion}>
            <span>Carbs</span>
            <strong>{carbohydrate} g</strong>
          </div>
        ) : null}
      </div>
      <p className={styles.perHundred}>
        Per {product.nutritionBasis === "100ml" ? "100 ml" : "100 g"} · {product.ratingSignalCount} of 2 source-backed
        signals
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
