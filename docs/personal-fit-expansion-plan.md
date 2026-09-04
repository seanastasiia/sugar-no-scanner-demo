# Personal Fit expansion work plan

Owner approval: 4 September 2026, "Распиши этот план себе и делай по шагам".

## Boundaries and baseline

- Start from preview `b4e74534d08adc3a0b4be7f8fbd485f122c9c29a`, model v1.4.
- Latest audit: 19,524 source records, not globally unique products; 3,335 assessable, 3,582 supported but incomplete, 12,607 unsupported/unclassified.
- Work on `codex/personal-fit-catalog-preview` and the isolated Railway preview. Do not push to main or change production, credentials, billing, vendor agreements or schedules.
- No invented nutrition, no silent source/recipe merging, no missing-to-zero conversion, no camera-image persistence. Preserve source, exact identity, language, per-100 basis and observation date. OFF remains in its separately attributed ODbL layer.
- A source refusal/rate limit stops that source, not a retry loop or bypass. Record unresolved items honestly. No paid database purchase or outreach is included.

## Ordered steps

1. [x] **Freeze and inspect the baseline.** Save reproducible source hashes, missing-data reasons and current assessment outputs. Build an explicit 200-ID enrichment cohort from supported incomplete records, prioritizing useful shelf categories and exact available source URLs. Do not confuse a source record with a unique physical product.
2. [x] **Run the 200-card evidence pilot.** Use existing exact product pages first; try bounded public-source discovery for misses where identity can be proven. Persist checkpoints and per-ID outcomes. Accept whole source observations, never AI-generated nutrients. Report attempted, blocked, accepted and newly assessable separately, plus elapsed time and any provider cost.
3. [ ] **Expand Open Food Facts.** Verify official bulk formats/limits and safe resource requirements. Import relevant Latvia/Lithuania/Belarus records into an isolated candidate output; retain multilingual aliases, valid barcodes and original ingredient/nutrient provenance. Count net new IDs and usable scores. Avoid storing a multi-gigabyte dump on the laptop or performing bulk work in the web process. If the available export cannot be processed safely, document the exact external prerequisite rather than claiming completion.
4. [x] **Review category coverage.** Separate missing source categories from genuinely new product types. Prefer tightly proven source-category mappings to existing profiles, with a before/after audit; do not broaden food scoring by product-name guesses. New profiles need a documented rationale and calibration. Record the remaining category queue.
5. [ ] **Close the scan-to-catalog loop.** Audit current shared-web persistence and Personal Fit evidence support. Make only source-verified, image-free updates consistent with existing privacy boundaries. A photo-label contribution flow is a separate opt-in UI change if needed, not automatic retention of scans. Provider permissions and a safe test database must exist before activating shared writes.
6. [ ] **Verify and release preview.** Update README/Bugs and this checklist with actual outcomes. Run technical acceptance, push only the preview branch, deploy only the isolated preview and verify the deployed revision. Record external prerequisites and remaining work explicitly.

## Technical acceptance planned before edits

- Pure tests: exact identity/variant/pack rejection; supported language and basis; unknown values; contradictory source tables; GTIN validation; source/ODbL separation; checkpoints, idempotence, cooldown and bounded request behavior.
- Per-ID baseline comparison: no changed old assessments unless a newer exact source observation or explicitly reviewed category correction explains the change. No accidental catalog deletion or duplicate source IDs. Demo and legacy Fit remain unchanged.
- Full release: `npm run verify`, Mobile Safari suite, offline catalog/quality reports, `git diff --check`, terminal Railway SUCCESS and live health/revision agreement.
- No test may assert that missing source data is complete or that more catalog records prove better visual recognition.

## Owner product checks

1. Refresh preview, reuse a real shelf photo, open View all / Personal Shelf Rank, and compare newly rated products with the same packages.
2. Check sugar/protein and a different flavour or pack; wrong variants must not borrow evidence.
3. Check a provisional and a still-missing card; unknown fiber remains unknown and conflicts stay neutral.
4. Switch back to original Fit and open the chip demo; both should retain the established behavior.

## Execution log

- Plan recorded before code/data changes. Baseline checkout clean; no production write or recurring job started.

- Pilot complete: 200 unique IDs, 140 accepted observations, 86 newly assessable; 41 extra parser-only Rimi retries. Initial request pass 128 seconds; retry 80 seconds. No paid-provider calls. 60 IDs remain rejected/unavailable, not guessed.
- Source-category review complete: 307 IDs, 297 accepted pages, 229 added assessments in 214 seconds. Existing category weights are unchanged. Initial post-enrichment total: 4,509 observations / 3,650 assessments (1,287 complete, 2,363 provisional).
- Baseline comparison passes: all prior 3,335 assessments and four ordinary Shelf-demo observations unchanged; no removed evidence or duplicate source/evidence IDs. Remaining inventory: 3,574 supported-type missing rows, 12,100 unmapped/missing source-category rows and 200 observed unsupported-basis rows. 34 contradictory tables stay neutral.
- Shared-card composition code and additive SQL migration pass isolated PostgreSQL tests, including language/basis/GTIN agreement, permanent conflict quarantine, idempotence and browser-role denial. Activation is pending an approved isolated Supabase target; the new flag stays off. No remote database migration or image retention was introduced.
- Regional OFF CSV stream is in progress; no net-new OFF count is claimed before candidate validation. Optional Parquet exploration was stopped without promoting partial files because the export has 4,615 small row groups.
- Mobile Safari acceptance: 58/58 pass in two fresh dev-server shards with zero retries. Optional local production HTTP tests encountered the existing Secure-cookie/401 harness limitation; production cookie security is unchanged. Railway HTTPS smoke is still required.
