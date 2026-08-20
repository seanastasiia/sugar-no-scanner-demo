# Sugar.no Live Scanner

Private Latvia proof of concept for camera-based comparison of packaged protein snacks. The scanner is a wellness discovery tool, not a medical device and not an absolute health rating.

## Current state

The repository currently contains the Next.js/Railway/Supabase foundation and the deterministic `Sugar.no Match` scoring core. Camera UI, recognition routes and the complete product seed are under active implementation.

Important data rule: AI may identify one of the supported product IDs, but it never invents nutrition. A Match is returned only when protein, fiber and total sugars have field-level sources.

## Stack

- Next.js 16 App Router, React 19 and TypeScript
- Gemini image understanding behind a server-only adapter
- Supabase for catalog and anonymous event metadata
- Railway with standalone Next.js output
- Vitest and Playwright

## Local setup

Requirements: Node.js 22 or newer.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. In development, leaving `DEMO_ACCESS_CODE` blank allows local access. Production must set an access code and a random session secret.

## Environment

See `.env.example` for every supported variable.

- `DEMO_ACCESS_CODE`, `DEMO_SESSION_SECRET`: private investor access.
- `GEMINI_API_KEY`, `GEMINI_MODEL`: server-side recognition provider.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: server-only catalog and analytics storage.
- `RECOGNITION_CONFIDENCE_THRESHOLD`: minimum confidence before a known product is shown.

Never expose service-role or Gemini keys through `NEXT_PUBLIC_*` variables.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run verify
npm run catalog:sync
npm run catalog:validate
npm run supabase:seed
```

## Catalog policy

The prototype targets 40 products found in Barbora Latvia's high-protein category. Retailer pages are used for product identity, exact product links, protein and total sugars. Barbora does not currently publish numeric fiber for the selected products, so fiber requires a separate manufacturer or label source. Until that source exists, the UI must show `Needs fiber data` instead of a Match.

Prices are not stored or displayed. `View at Barbora` always means “check current availability and price”, not “cheaper online” and not an affiliate claim.

## Privacy

- Camera access starts only after the browser permission prompt.
- The client downsizes frames and allows one recognition request at a time.
- Raw frames are not written to Supabase, logs or analytics.
- Stored scan metadata is pseudonymous and contains source type, latency, confidence and product IDs only.

## Supabase

Database changes live in `supabase/migrations`. Apply them with the Supabase CLI, then seed the verified catalog:

```bash
npx supabase db push
npm run supabase:seed
```

The application has a read-only local seed fallback for development. Production should configure Supabase.

## Railway

The checked-in `railway.json` uses Railpack, `npm ci && npm run build`, `npm run start`, and `/api/health`.

```bash
npm run verify
railway link
railway up
railway status
```

The intended release path is GitHub `main` to Railway. A release is complete only after tests, push, successful Railway build and a live health check.

## Testing evidence

Test runs are recorded in `docs/test-runs/` with commit SHA, commands and outcomes. Product QA instructions are kept in `docs/product-qa.md`.

## Known limitations

See [Bugs.md](./Bugs.md). The first benchmark uses supplied or generated images on iPhone Safari. It does not establish real shelf, glare or conveyor accuracy.
