# Bugs

This file is the running record of scanner defects found and resolved.

## Open

- Real packaging, glare, low-light and physical conveyor accuracy are not validated. The first proof of concept uses supplied or generated images only.
- Barbora exposes protein and total sugars for the selected catalog, but not numeric fiber. Products without an independently verified fiber value must remain unrated.

## Resolved

- **2026-08-20: lint crashed with the newest TypeScript and ESLint majors.** `eslint-config-next@16.3.1` currently depends on plugins that reject TypeScript 7 and ESLint 10 APIs. The project pins TypeScript 6.0.3 and ESLint 9.39.5 until the Next lint stack supports the newer majors.
