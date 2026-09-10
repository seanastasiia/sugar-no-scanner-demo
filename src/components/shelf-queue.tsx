"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { assessPersonalShelfProduct } from "@/lib/personal-shelf-rank";
import { queueLookupSchema, validQueueBarcode, queueOwner, type QueueLookup, type ShelfQueueItem } from "@/lib/shelf-queue";
import type { ProductDetection, ProductRecord } from "@/lib/types";
import { PersonalShelfResults } from "./personal-shelf-results";
import styles from "./shelf-queue.module.css";

const OUTBOX_KEY = "sugar-shelf-queue-outbox-v1";
function readOutbox(): QueueLookup[] {
  try { const items = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]"); return Array.isArray(items) ? items.slice(0, 30) : []; } catch { return []; }
}
export async function shelfQueueRequest(action: "list" | "enqueue" | "retry", items?: QueueLookup[], id?: string): Promise<ShelfQueueItem[]> {
  const token = queueOwner();
  if (action === "enqueue" && items) {
    if (items.some(item => !queueLookupSchema.safeParse(item).success)) throw new Error("Check the barcode and exact product details.");
    if (items.some(item => { if (!item.sourceUrl) return false; const url = new URL(item.sourceUrl); return url.protocol !== "https:" || !["rimi.lv", "www.rimi.lv", "livinn.lt", "www.livinn.lt", "barbora.lv", "www.barbora.lv"].includes(url.hostname) || url.username || url.password || url.port || url.pathname === "/"; })) throw new Error("Use a direct HTTPS product link from Rimi, Livinn or Barbora.");
    const combined = [...new Map([...readOutbox(), ...items].map(item => [JSON.stringify(item), item])).values()];
    if (combined.length > 30) throw new Error("Your offline queue is full. Reconnect to save it first.");
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(combined));
  }
  const pending = action === "retry" ? [] : readOutbox().slice(0, 10);
  const requestAction = pending.length ? "enqueue" : action;
  const response = await fetch("/api/pilot/shelf-queue", { method: "POST", headers: { "content-type": "application/json", "x-shelf-queue-key": token }, body: JSON.stringify({ action: requestAction, ...(pending.length ? { items: pending } : {}), ...(id ? { id } : {}) }) });
  const body = await response.json();
  if (!response.ok) {
    if (response.status === 400 && pending.length) {
      // Do not let invalid barcode data permanently block every later product.
      const bad = new Set(pending.map(item => JSON.stringify(item)));
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(readOutbox().filter(item => !bad.has(JSON.stringify(item)))));
    }
    throw new Error(body.error === "queue_limit" ? "Today’s research limit is reached. Saved products will keep processing." : body.error === "retry_later" ? "You can request another search one hour after the last attempt." : body.error === "invalid_request" ? "Check the barcode and retailer link, then submit again." : "Could not reach your queue. Products waiting to be sent are saved in this browser.");
  }
  if (pending.length) {
    const sent = new Set(pending.map(item => JSON.stringify(item)));
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(readOutbox().filter(item => !sent.has(JSON.stringify(item)))));
  }
  return body.items;
}
export function useShelfQueue(enabled: boolean, detections: ProductDetection[], products: Record<string, ProductRecord>) {
  const [items, setItems] = useState<ShelfQueueItem[]>([]);
  const [error, setError] = useState("");
  const pending = useRef(new Set<string>());
  const submitted = useRef(new Set<string>());
  const candidates = enabled ? detections.flatMap(detection => {
    const product = products[detection.productId];
    const status = product && assessPersonalShelfProduct(product).status;
    if (status === "scored" || status === "provisional") return [];
    const identity = detection.identity;
    if (!identity?.brand || !identity.name || detection.confidence < .78) return [];
    return [{ ...(/^(?:barbora:|rimi_lv:|livinn_lt:|off:|web:shared:)/.test(detection.productId) ? { productId: detection.productId } : {}),
      brand: identity.brand, name: identity.name, variant: identity.variant || "", packSize: identity.packSize || "",
      ...(identity.barcode && validQueueBarcode(identity.barcode) ? { barcode: identity.barcode } : {}) }];
  }).slice(0, 10) : [];
  const candidateKey = JSON.stringify(candidates);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const refresh = () => shelfQueueRequest("list").then(rows => { if (!cancelled) { setItems(rows); setError(""); } }).catch(() => { if (!cancelled) setError("Queue unavailable. Open My products to retry."); });
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 10000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    const batch: QueueLookup[] = JSON.parse(candidateKey);
    const unseen = batch.filter(item => !submitted.current.has(JSON.stringify(item)) && !pending.current.has(JSON.stringify(item)));
    if (!unseen.length) return;
    unseen.forEach(item => pending.current.add(JSON.stringify(item)));
    void shelfQueueRequest("enqueue", unseen).then(rows => {
      unseen.forEach(item => submitted.current.add(JSON.stringify(item)));
      setItems(rows); setError("");
    }).catch(() => setError("Some products could not be saved. Open My products to retry."))
      .finally(() => unseen.forEach(item => pending.current.delete(JSON.stringify(item))));
  }, [enabled, candidateKey]);
  const replacements: Record<string, ProductRecord> = {};
  for (const item of items) {
    if (!item.result || item.status !== "ready") continue;
    for (const detection of detections) {
      const identity = detection.identity;
      if (item.lookup.productId === detection.productId || (identity && item.lookup.brand === identity.brand && item.lookup.name === identity.name && item.lookup.variant === (identity.variant || "") && item.lookup.packSize === (identity.packSize || ""))) replacements[detection.productId] = item.result;
    }
  }
  return { items, replacements, error };
}
const statusLabels = { queued: "Queued", searching: "Searching sources", ready: "Added", needs_info: "Needs your help", review: "Needs evidence review", retry: "Retrying automatically", failed: "Could not finish" };
export function ShelfQueuePage() {
  const [items, setItems] = useState<ShelfQueueItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<QueueLookup | null>(null);
  const refresh = useCallback(async () => {
    try { setItems(await shelfQueueRequest("list")); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Queue unavailable"); }
  }, []);
  useEffect(() => { const t = setTimeout(() => { void refresh(); }, 0); const poll = setInterval(() => { if (!document.hidden) void refresh(); }, 10000); return () => { clearTimeout(t); clearInterval(poll); }; }, [refresh]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const value = (key: string) => String(data.get(key) || "").trim();
    const lookup: QueueLookup = { brand: value("brand"), name: value("name"), variant: value("variant"), packSize: value("packSize"), ...(value("barcode") ? { barcode: value("barcode") } : {}), ...(value("sourceUrl") ? { sourceUrl: value("sourceUrl") } : {}) };
    if (!lookup.barcode && (!lookup.brand || !lookup.name)) { setError("Enter a barcode, or both brand and exact product name."); return; }
    setBusy(true);
    try { setItems(await shelfQueueRequest("enqueue", [lookup])); setError(""); setEditing(null); form.reset(); } catch (e) { setError(e instanceof Error ? e.message : "Could not save"); } finally { setBusy(false); }
  };
  const ready = items.flatMap(item => item.status === "ready" && item.result ? [item.result] : []);
  return <main className={styles.page}>
    <nav><Link href="/pilot/shelf">← Back to scanner</Link><span>Personal Shelf · Pilot</span></nav>
    <h1>My products</h1>
    <p>Unreadable or unrated products belong here. We look for exact ingredient and nutrition sources in the background. Photos are not saved. This queue stays in this browser.</p>
    {error ? <p role="alert" className={styles.notice}>{error} <button onClick={() => void refresh()}>Retry connection</button></p> : null}
    <details className={styles.card} open={editing ? true : undefined}>
      <summary>{editing ? "Complete product details" : "Add a product the scanner missed"}</summary>
      <form key={JSON.stringify(editing)} onSubmit={submit} className={styles.form}>
        <p>Use the barcode or the exact name on the pack. A retailer link can help us verify the right recipe.</p>
        <label>Barcode<input name="barcode" inputMode="numeric" pattern="[0-9]{8}|[0-9]{12,14}" maxLength={14} defaultValue={editing?.barcode} /></label>
        <label>Brand<input name="brand" maxLength={80} defaultValue={editing?.brand} /></label>
        <label>Product name<input name="name" maxLength={180} defaultValue={editing?.name} /></label>
        <label>Variant<input name="variant" maxLength={120} defaultValue={editing?.variant} /></label>
        <label>Pack size, e.g. 150 ml<input name="packSize" maxLength={60} defaultValue={editing?.packSize} /></label>
        <label>Rimi or Livinn product link (optional)<input name="sourceUrl" type="url" maxLength={1500} defaultValue={editing?.sourceUrl} /></label>
        <button disabled={busy} type="submit">{busy ? "Saving…" : "Find this product"}</button>
      </form>
    </details>
    <h2>Research queue</h2>
    {!items.length ? <p>No products saved yet. Scan your shelf, or add a product above.</p> : null}
    <ul className={styles.list}>{items.map(item => <li key={item.id} className={styles.card}>
      <strong>{[item.lookup.brand, item.lookup.name, item.lookup.variant, item.lookup.packSize].filter(Boolean).join(" ") || `Barcode ${item.lookup.barcode}`}</strong>
      <p className={styles.status}>{statusLabels[item.status]}</p>
      <p>{item.reason || "Saved. Research continues even after you close this page."}</p>
      {item.missing.length ? <p>Missing: {item.missing.join(", ")}</p> : null}
      {["needs_info", "review", "failed"].includes(item.status) ? <div><button onClick={() => { setEditing(item.lookup); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Add or correct details</button>{" "}<button onClick={() => { void shelfQueueRequest("retry", undefined, item.id).then(setItems).catch(e => setError(e.message)); }}>Search again</button></div> : null}
    </li>)}</ul>
    {ready.length ? <PersonalShelfResults products={ready} context="demo" thumbnail={() => null} /> : null}
  </main>;
}
