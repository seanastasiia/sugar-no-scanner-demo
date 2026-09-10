# Hide accepted advertising privacy control

Base: `b375ae9e9b813b618a6a02889b36df761a7c285c`. Tested source is the application diff in the commit containing this report.

- `npm run verify`: PASS, 87 files / 750 tests, catalog validators and production build.
- Production-build Meta consent browser suite: 3/3 PASS; accepted control absent immediately and after reload; `/?privacy=1` reopens; withdrawal stops tracking; denied controls retain mobile clearance.
- Full CI Mobile Safari suite, one worker: 70 passed, 3 Meta scenarios skipped (tested separately), 1 first-visit contrast failure. Its isolated rerun passed 1/1 without source changes; the full-run failure is retained as a test-stability limitation.
- `git diff --check`: PASS.
- Raw logs: `.catalog-sync/privacy-ui/{verify,meta,e2e,recheck}.log` (local, ignored). Initial lint found a leftover ignored QA script from the preceding release; its source was preserved as `.ts.txt` before the successful verify run.

Owner check: Allow Meta cookies, reload, confirm there is no privacy control. Open `/?privacy=1` to review the choice; No thanks restores Ad privacy and revokes consent.

Release completion requires GitHub main, Railway SUCCESS, matching live health SHA, and live browser allow/reload/reopen/revoke smoke. Production evidence is recorded in the shared codex update after deployment.
