# Real checkout photo release evidence

Date: 2026-08-24  
Release SHA: `b78ade9be8320a0cbcd629a79b925b5c6323e429`  
Production: https://sugar-no-scanner-demo-production.up.railway.app  
GitHub Actions: https://github.com/seanastasiia/sugar-no-scanner-demo/actions/runs/32771285442

## Scope

- Replaced the staged checkout fixture with the real checkout-belt photo supplied by the project owner.
- Cropped the original to the product area, resized it to `900 × 1600`, encoded it as a progressive JPEG and removed all EXIF/GPS metadata.
- Pinned the three package identities returned by one successful Gemini read: Sproud, Schnitzer Bio Burger Buns and Stockmann chanterelles.
- Kept all three identities `visual_only`: no nutrition, Sugar.no fit, shelf price or retailer offer is generated.
- Kept the product rule that only rated products receive camera markers; the three unrated packages remain available in the results sheet.

## Recognition observation

Two independent live calls on the original photo were not fully stable: the first returned two distinct packaged identities and a later call returned three. The deterministic demo pins the successful three-identity result so investor UX is repeatable. This is interaction evidence, not a recognition-accuracy claim.

## Technical checks

- `npm run verify`: passed.
  - ESLint: passed.
  - TypeScript: passed.
  - Vitest: 16 files, 80 tests passed.
  - Next.js production build and standalone asset preparation: passed.
- Targeted local Mobile Safari: `checkout photo uses one multi-product scan instead of an animated product` passed.
- Full GitHub Mobile Safari/benchmark workflow #12: passed in 3m 19s on exact SHA `b78ade9`.
- Production `/api/health`: `status=ok`, exact SHA `b78ade9be8320a0cbcd629a79b925b5c6323e429`.
- Production `POST /api/recognize` with `source=sample-conveyor`: `matched`, three detections, all `visual_only`, `imageStored=false`.
- Local, GitHub raw and production checkout JPEG SHA-256: `c9a6a376be9a8bffd9362842b95320683e040f92513e938abc6d89b13a69756c`.
- Production checkout JPEG: `900 × 1600`, zero EXIF entries.

## Product checks completed

- Checkout opens on the real conveyor photo and keeps the camera-first layout.
- Collapsed sheet says `3 products · 0 with Sugar.no fit` and `Recognized packages`.
- No gray identity markers or fake fit markers appear over the photo.
- Preview names Sproud, Schnitzer and Stockmann.
- Expanded results preserve the three exact product names and show `Product recognized` with the no-invented-score explanation.
- No Save action, price comparison or Barbora purchase claim appears for these unverified identities.

## User check

1. Open production on iPhone Safari and tap `Show demo` → `Checkout demo`.
2. Confirm this exact real checkout photo appears.
3. Confirm the compact sheet says `3 products · 0 with Sugar.no fit` and names Sproud, Schnitzer and Stockmann.
4. Tap `View all` and check the three full names.
5. Confirm there are no fit markers, prices or Buy-at-Barbora claims for these identities.
