[Evidence report](../../docs/evidence/reddit-live-action-quota-2026-10-02.md).

Final terminal evidence:

- `emulator-handoff.log`: real Firestore/RTDB, 48 cases in four suites.
- `distributed-quotas.log`: independent Node 22 processes enforce exact shared caps.
- `functions-units-handoff.log`: 56 units in four suites.
- `functions-types-handoff.log`, `functions-lint-handoff.log`, `functions-emit.log`,
  `compiled-runtime.log`, `module-cycles.log`, `tsdoc-handoff.log`: static/runtime checks.
- `platform-browsers.log`: actual isolated Facebook/Reddit artifact journeys.
- `build-results.json`, `build-*.log`, `audit-*.log`: all six private output directories and audits.
- `reddit-progress.log`, `facebook-progress.log`, `diff-check.log`: documentation checks.

`baseline.log` preserves four signed command requests incorrectly refused with
HTTP 429. `emulator-final.log` preserves the original presence contention failure.
`first-fix.log`, `focused-final.log`, `emulator-regressions.log` preserve explained
fixture/environment failures. The first broad failed Jest run was explicitly
terminated after its terminal failure report left RTDB retries running; its
Firebase wrapper exit after termination is not a passing suite result.

Commands run from `firebase-functions`:

```sh
pnpm exec firebase emulators:exec --only firestore,database \
  --project demo-riddle-live-quota \
  --config ../artifacts/reddit-live-action-quota-2026-10-02/emulator.json \
  'node scripts/run-with-functions-node.js node_modules/jest/bin/jest.js --config jest.rules.config.js --runInBand --runTestsByPath src/__tests__/redditGatewayReplay.it.test.ts src/__tests__/redditPresence.it.test.ts src/__tests__/race/redditLiveReferrals.it.test.ts src/__tests__/race/facebookLiveTournamentDelivery.it.test.ts'
```

The distributed diagnostic uses the same demo guard and `--only firestore`;
its script, private build runner and compiled-load check are retained under
`diagnostic/`. All secrets in tests are local fixtures; no provider payload or
production credential is captured. Artifacts remain diagnostic and ineligible
for upload from this concurrently edited dirty checkout.
