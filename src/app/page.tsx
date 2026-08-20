import { Camera, Database, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <main className="foundation-page">
      <section className="foundation-card" aria-labelledby="page-title">
        <div className="wordmark" aria-label="Sugar dot no">
          Sugar<span>.no</span>
        </div>
        <p className="eyebrow">Latvia investor demo</p>
        <h1 id="page-title">
          Make the shelf <em>understandable.</em>
        </h1>
        <p className="lede">
          Point your camera at a supported protein snack. Sugar.no compares protein, fiber and total
          sugar without labelling food as good or bad.
        </p>
        <div className="foundation-status" role="status" aria-live="polite">
          <Sparkles aria-hidden="true" size={18} />
          Scanner foundation is running
        </div>
        <ul className="foundation-list">
          <li>
            <Camera aria-hidden="true" />
            Automatic camera flow
          </li>
          <li>
            <Database aria-hidden="true" />
            Verified nutrition only
          </li>
        </ul>
      </section>
    </main>
  );
}
