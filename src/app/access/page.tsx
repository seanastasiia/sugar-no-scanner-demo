import { Suspense } from "react";
import { AccessForm } from "@/components/access-form";

export default function AccessPage() {
  return (
    <main className="access-page">
      <section className="access-card" aria-labelledby="access-title">
        <div className="wordmark" aria-label="Sugar dot no">
          Sugar<span>.no</span>
        </div>
        <p className="eyebrow">Private proof of concept</p>
        <h1 id="access-title">The shelf, made clearer.</h1>
        <p className="access-copy">
          This Latvia demo recognizes a deliberately limited catalog. It is not medical advice or an
          absolute rating of food.
        </p>
        <Suspense fallback={<div className="access-loading">Loading access…</div>}>
          <AccessForm />
        </Suspense>
      </section>
    </main>
  );
}
