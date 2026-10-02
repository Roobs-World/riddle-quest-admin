# Local Facebook context recovery verification

Report: `docs/evidence/facebook-live-contexts-2026-10-02.md`.

- Recorder baseline: two real-engine failures, one per winning seat.
- Browser baseline: native chooser unavailable in the fresh artifact.
- Overlay contract baseline/fix: documented show/dismiss shape rejected/accepted.
- Emulator final: 44 tests / six suites on an isolated loopback demo instance.
- Functions units: 33 tests / five suites; focused platform units: 173 / eight.
- Portal units: 2,236 / 264; 116 browser tests in 15 suites are skipped.
- Provider browsers: Facebook and Reddit each pass their injected artifact journey.
- Six target builds and audits use owned output directories, not shared defaults.
- Types, lint, profile boundary, TSDoc, cycles and Node 22 module-load logs retained.
- `meta-read-scope.json` retains only the intended app's sanitized read-only facts.
- `context-mobile.png` is the inspected production-artifact screenshot.
- `manifest.json` binds evidence and output/source hashes, with upload eligibility false.

The earlier emulator isolation diagnostic is retained: a reused synthetic context
already contained a prior successful row. Clearing the exact demo fixture's
context before each real match removes that test-order contamination. An
intermediate browser build failed because the new component had not yet been
written at the intended absolute path; the final browser and build logs replace
that intermediate invocation. Neither issue is reported as passing coverage.

```sh
cd firebase-functions
pnpm exec firebase emulators:exec --config ../artifacts/facebook-live-contexts-2026-10-02/emulator.json --project demo-riddle-quest-live-contexts --only firestore 'pnpm exec jest --config jest.rules.config.js --runInBand --runTestsByPath src/__tests__/race/facebookContextBoard.it.test.ts src/__tests__/race/facebookContextService.it.test.ts src/__tests__/race/facebookTournament.it.test.ts src/__tests__/race/redditTournament.it.test.ts src/__tests__/race/facebookLiveTournamentDelivery.it.test.ts src/__tests__/race/redditLiveTournamentDelivery.it.test.ts'
```

`diagnostic/build-targets.cjs` builds and explicitly audits each owned output.
`diagnostic/overlay-contract.cjs` type-checks the minimal documented SDK shape.
`diagnostic/compiled-runtime.cjs` loads the private compiled recorder modules on
the pinned Functions Node 22 runtime, without making a network request.

No deployment, upload, public provider configuration mutation, live purchase,
or real player notification occurs in these checks. Hosted/device acceptance,
closed-browser context recovery, and live friend matching are not claimed.
