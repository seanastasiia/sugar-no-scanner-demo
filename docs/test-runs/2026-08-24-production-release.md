# Production release · public multi-product shelf scanner

Date: 2026-08-24 (Europe/Riga)

Release candidate: product commit `4c9fe5228e20b5343b5fe484549def25f38956e2` on GitHub `main`.

## Pre-deploy gates

- `npm run verify`: pass (ESLint, TypeScript, 15 Vitest files / 92 tests, production build).
- Catalog validation: pass (40 scored products, 10 complete nutrition rows, 19,076 Barbora pages indexed).
- 21 Mobile Safari scenarios authored and discovered; execution remains pending because the managed local sandbox rejects loopback listeners.
- Railway GitHub App is restricted to `seanastasiia/sugar-no-scanner-demo`; source branch is `main`; automatic deploys are enabled.

## Production evidence

Pending Railway build, exact health SHA, public camera/demo smoke, deterministic shelf/checkout smoke and real Latvian shelf-image benchmark.
