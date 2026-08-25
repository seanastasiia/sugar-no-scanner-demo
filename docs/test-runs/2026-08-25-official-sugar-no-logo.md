# Official Sugar.no logo release check

- Date: 2026-08-25, Europe/Riga
- Scope: replace the scanner's approximated text wordmark with the official logo currently published on `sugar.no`.

## Source and implementation

- Primary source: `https://sugar.no/`, inspected on 2026-08-25.
- The website embeds its logo as an SVG with a `0 0 137 26.07` viewBox, one symbol path and one wordmark path, both white.
- The exact SVG is stored as `public/brand/sugar-no-logo-white.svg`; no path was redrawn or recolored.
- The scanner renders the local first-party file with intrinsic dimensions, preserved aspect ratio and `alt="Sugar.no"`. Production therefore has no runtime dependency on Framer's page or CDN.

## Technical checks

- `xmllint --noout public/brand/sugar-no-logo-white.svg` — pass.
- Targeted Mobile Safari regression (`public root`, `375 × 812` portrait / `812 × 375` landscape and iPhone 17 Pro viewport matrix) — 3/3 pass.
- `npm run verify` — pass: ESLint, TypeScript, 20 Vitest files / 109 tests and the production build.
- `CI=1 npm run test:e2e` — pass: 21/21 Mobile Safari scenarios, including accessibility, reduced motion, enlarged text and dark mode.
- Browser assertions verify one visible `img` with `alt="Sugar.no"`, the local `/brand/sugar-no-logo-white.svg` path, a decoded image, the source aspect ratio and complete viewport containment.
- Visual evidence: `docs/screenshots/iphone-17-pro-camera.png`, `docs/screenshots/iphone-17-pro-results.png` and `docs/screenshots/iphone-17-pro-landscape.png`.

## Release evidence

- Behavior commit: `7b12aaf948485a9a18704c8a0f400c5df921d2c7`, pushed to GitHub `main`.
- Direct Railway deployment: `76796ba7-a3d9-4998-bbd3-efd9fd391375` — `SUCCESS`.
- Production health: `/api/health` returned `status: ok` and the exact behavior commit above.
- Production asset: `/brand/sugar-no-logo-white.svg` returned HTTP 200 with `content-type: image/svg+xml`.
- Production HTML contains the local SVG path, `alt="Sugar.no"`, `width="137"` and `height="26.07"`.

## Product check after deployment

1. Open production on an iPhone and confirm the top-left header contains the symbol plus Sugar.no wordmark from the website.
2. Compare its letterforms and symbol with the current header/footer logo on `sugar.no`.
3. Confirm the logo remains sharp, uncropped and proportionate in portrait and phone landscape.
4. Deny camera permission and open both Shelf and Checkout demos; confirm the white logo stays readable over every scanner state.
