# Local notification integration verification

Report: `docs/evidence/facebook-notification-byte-binding-2026-10-02.md`.

- `transport-baseline.log`: missing actual-byte commitment in authorization.
- `registration-baseline.log`: push suite was absent from the emulator config.
- `composition-baseline.log`: five mismatched requests reached injected HTTP.
- `emulator-final.log`: 34 distinct cases, three suites, local demo emulator.
- `emulator-duplicate-invocation.log`: intermediate repeated dispatch suite;
  its 46 executions are not reported as unique coverage.
- `functions-units.log`: 48 tests; `transport-final.log`: 26 of those tests.
- `portal-platform-units.log`: 169 tests; `provider-browsers.log`: two journeys.
- Build/audit logs and `build-results.json`: six isolated owned outputs.
- Type/lint/TSDoc/cycle/runtime logs retain static and compiled Node 22 checks.
- `manifest.json`: final source/output/evidence hashes, `uploadEligible: false`.

Final emulator invocation:

```sh
cd firebase-functions
pnpm exec firebase emulators:exec --config ../artifacts/facebook-notification-byte-binding-2026-10-02/emulator.json --project demo-riddle-quest-notification-bytes --only firestore 'pnpm exec jest --config jest.rules.config.js --runInBand --runTestsByPath src/__tests__/race/raceLivePush.it.test.ts src/__tests__/facebookNotificationDispatch.it.test.ts src/__tests__/facebookNotificationPrompts.it.test.ts'
```

`diagnostic/build-targets.cjs` runs each target build and audits its exact output.
Provider browsers use `PORTAL_BROWSER_TESTS=1`, `PORTAL_USE_EXISTING_BUILD=1` and
the retained Reddit output through `PORTAL_REDDIT_BUILD_DIR`. Facebook's harness
builds its own temporary production artifact. All provider HTTP responses in
the notification tests are synthetic and explicitly unconfirmed without a real
decoder; none of these commands sends a real player notification.
