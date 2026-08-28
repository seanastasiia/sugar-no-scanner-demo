import Image from "next/image";
import { Suspense } from "react";
import { AccessForm } from "@/components/access-form";

export default function AccessPage() {
  return (
    <main className="access-shell">
      <section className="access-card" aria-labelledby="access-title">
        <Image
          src="/brand/sugar-no-logo-white.svg"
          alt="Sugar.no"
          width={184}
          height={46}
          priority
        />
        <p className="access-eyebrow">Latvia investor demo</p>
        <h1 id="access-title">Live Scanner</h1>
        <p className="access-copy">
          Enter the demo code to compare visible products on a shelf.
        </p>
        <Suspense fallback={<p className="access-copy">Loading…</p>}>
          <AccessForm />
        </Suspense>
      </section>
    </main>
  );
}
