# Compact fit marker icons — 2026-08-27

## Change

- Replaced the camera overlay check, minus and down-arrow with Lucide thumbs-up, raised-hand and thumbs-down icons.
- Reduced every visible fit disc from 46 px to 24 px while retaining the detected-product outline as the full touch target.
- Kept Great, Moderate and Low marker discs exactly the same size and preserved text labels for the selected product.

## Technical checks

Validated release worktree based on production commit `17358afe8949ba988b6511d2da806308fa00d778`; the final release commit and Railway deployment are recorded in the shared Sugar.no update after publication.

| Check | Result |
| --- | --- |
| `npm run check:fast` | Pass; ESLint, TypeScript and 29 Vitest files / 153 tests |
| Targeted Shelf demo browser test | Pass; four equal `24x24` marker discs, two thumbs-up and two raised-hand icons, plus axe WCAG A/AA |
| Targeted exact-food browser test | Pass; Low fit overlay renders one thumbs-down icon |
| `npm run verify` | Pass; ESLint, TypeScript, 29 Vitest files / 153 tests and Next.js production build |
| `CI=1 npm run test:e2e` | Pass; 25/25 Mobile Safari scenarios in 55.9 seconds |
| Visual QA | Pass; `test-results/shelf-mobile.png` confirms the compact icons leave packaging readable (local artifact, intentionally ignored) |
| `git diff --check` | Pass |

The complete Mobile Safari suite includes narrow portrait, phone landscape, iPhone 17 Pro and adjacent viewports, enlarged text, reduced motion, dark mode, accessibility, camera permission failure, privacy/no-image-storage and the deterministic Shelf and Checkout demos.

## Product check

1. Open Shelf demo on an iPhone.
2. Confirm Great fit uses a white thumbs-up on green and Moderate fit uses a white raised hand on amber.
3. Scan or upload a Low fit product and confirm it uses a white thumbs-down on coral.
4. Confirm all three circles are the same compact size and no longer cover a large part of the package.
5. Tap inside the outlined package, including away from the small icon, and confirm the product still opens.
