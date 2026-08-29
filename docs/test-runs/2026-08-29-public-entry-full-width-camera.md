# Public entry and full-width live camera release

Date: 2026-08-29

GitHub implementation commit: `257dbca5de29683ca35714ed0e1bbef14785a1d9`

Target: Railway production, iPhone Safari-first investor demo

## Release scope

- Opens the camera-first scanner directly instead of showing the access-code page.
- Issues a silent 12-hour HTTP-only, same-site cookie so protected same-origin APIs remain unavailable to bare unauthenticated requests. This is request hardening, not viewer authentication.
- Makes the live camera span the full phone width with the Sugar.no brand, `Show demo` and recognition state over the feed.
- Keeps the live feed uncropped and unstretched with `object-fit: contain`; saved photos and deterministic demo scenes retain proportional rounded frames.
- Removes the persistent `Sent to Google Gemini…` line from camera chrome while preserving the documented third-party processing boundary.

## Final local technical verification

- `npm run verify`: ESLint passed; TypeScript passed; 35 Vitest files and 194 tests passed; Next.js production build passed.
- `CI=1 npm run test:e2e`: 28/28 Mobile Safari scenarios passed, including direct entry, full-width camera geometry, native capture resolution, iPhone 17 Pro and adjacent device layouts, privacy, accessibility, saved photos and deterministic demos.
- `npm audit --omit=dev`: 0 vulnerabilities.
- `git diff --check`: passed.

The first full browser run correctly exposed one stale rounded-live-camera assertion and a test-only race that could observe the later focus crop instead of the first full frame. Both test expectations were corrected to the agreed live-camera contract, then the complete browser suite passed without retries or failures.

## Product verification after deployment

1. Open production in a private iPhone Safari tab and confirm the scanner opens directly without a code page.
2. Allow camera access and confirm the live feed reaches both side edges of the phone.
3. Confirm the Sugar.no logo, `Show demo` and recognition state sit over the feed while `Live camera` and the persistent Google Gemini line are absent.
4. Point at a shelf and confirm the image is not digitally zoomed, stretched or filtered.
5. Open a saved portrait and landscape photo plus Shelf and Checkout demos; confirm each remains proportional inside its rounded media frame.
6. Confirm an anonymous request to a protected API is rejected even though the page itself is public.

## Known boundary

Anyone with the production link can obtain the silent same-site session by opening the page. An explicit identity or access gate is required before the URL is treated as private or restricted data is exposed.
