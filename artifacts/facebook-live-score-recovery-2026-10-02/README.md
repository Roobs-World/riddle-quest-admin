The report is [Facebook live score recovery](../../docs/evidence/facebook-live-score-recovery-2026-10-02.md).

Final runs:

- `emulator-regressions-final.log`: seven real Firestore suites, 185 cases.
- `portal-units.log`: 262 passing unit suites, 2,227 passing tests; browser skips remain explicit.
- `native-projection-final.log`: fourteen native projection cases.
- `platform-browsers.log`: Facebook/Reddit production-artifact Chromium journeys.
- `reddit-retained-browser.log`: Reddit rechecked against this run's retained build.
- `build-results.json`, `build-*.log`, `audit-*.log`: all six owned output directories and audits.
- `functions-types-final.log`, `functions-lint-final.log`, `portal-types-final.log`,
  `functions-emit.log`, `compiled-runtime.log`, `tsdoc-handoff.log`: final static/runtime gates.
- `progress-tracker*.log`, `reddit-progress-tracker.log`, `diff-check.log`: documentation gates.
- `meta-auth-read.json`: only the selected Riddle Quest authentication result, no token.

Real emulator command (run from `firebase-functions`):

```sh
pnpm exec firebase emulators:exec --only firestore --project demo-riddle-live-score \
  --config ../artifacts/facebook-live-score-recovery-2026-10-02/emulator.json \
  'node scripts/run-with-functions-node.js node_modules/jest/bin/jest.js --config jest.rules.config.js --runInBand --runTestsByPath src/__tests__/race/facebookLiveTournamentDelivery.it.test.ts src/__tests__/race/facebookLiveReferrals.it.test.ts src/__tests__/race/raceLiveAccountDeletion.it.test.ts src/__tests__/race/redditLiveReferrals.it.test.ts src/__tests__/race/facebookTournament.it.test.ts src/__tests__/race/raceLive.it.test.ts src/__tests__/race/raceSettlement.it.test.ts'
```

Owned output commands and source documentation helpers are retained under
`diagnostic/`. Initial red regressions, intermediate fixture failures and the
timestamp test failure are retained, not claimed as passing final checks.
The manifest has `uploadEligible: false`: hashes identify final retained bytes,
not immutable build-time source provenance in this shared dirty checkout.
