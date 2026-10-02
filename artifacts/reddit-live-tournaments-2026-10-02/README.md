# Local Reddit live tournament verification

Human-readable evidence: `docs/evidence/reddit-live-tournaments-2026-10-02.md`.

- `browser-baseline.log`, `emulator-baseline.log`, `delivery-baseline.log` retain
  the missing board and missing real-engine scores.
- `http-response-baseline.log` retains the real signed recorder's erroneous 401.
- `emulator-handoff.log` records 119 cases across eight suites passing against
  the loopback-only demo Firestore/RTDB configuration in `emulator.json`.
- `platform-browsers-final.log` records injected Facebook/Reddit browser checks;
  `portal-units-final.log` records 2,235 units and the separate browser skips.
- `functions-units-final.log` records 27 provider boundary units.
- Type, lint, runtime cycle, Node 22 loading and TSDoc logs retain their outcomes.
- `diagnostic/build-targets.cjs` builds into owned cache directories and audits
  each exact output. `build-results.json` and six build/audit logs record results.
- `meta-auth-read.json` retains only Riddle Quest's scoped authentication status,
  with no token or unrelated app metadata.
- `manifest.json` records terminal evidence and final source/output hashes.

Commands for the final checks:

```sh
cd firebase-functions
pnpm exec firebase emulators:exec --config ../artifacts/reddit-live-tournaments-2026-10-02/emulator.json --project demo-riddle-quest-reddit-score --only firestore,database 'pnpm exec jest --config jest.rules.config.js --runInBand --runTestsByPath src/__tests__/race/redditTournament.it.test.ts src/__tests__/race/redditLiveTournamentDelivery.it.test.ts src/__tests__/race/redditLiveReferrals.it.test.ts src/__tests__/race/facebookLiveTournamentDelivery.it.test.ts src/__tests__/race/facebookTournament.it.test.ts src/__tests__/race/facebookLiveReferrals.it.test.ts src/__tests__/race/raceLiveAccountDeletion.it.test.ts src/__tests__/redditGatewayReplay.it.test.ts'
pnpm exec jest --config jest.config.js --runInBand --runTestsByPath src/__tests__/race/redditTournament.test.ts src/__tests__/race/facebookTournament.test.ts src/__tests__/race/facebookTournamentCallable.test.ts src/__tests__/redditGameplayEndpoint.test.ts src/__tests__/redditLiveRaceProfile.test.ts
pnpm exec tsc -p tsconfig.json --noEmit
pnpm check:module-cycles
```

Portal browser invocation uses `PORTAL_BROWSER_TESTS=1`,
`PORTAL_USE_EXISTING_BUILD=1` and `PORTAL_REDDIT_BUILD_DIR` pointing to the owned
Reddit output, with both provider browser suites in `jest.config.cjs`.
Facebook's harness builds its own temporary production artifact.
All artifacts are local diagnostics with `uploadEligible: false`; no deployment
or provider configuration change is part of this evidence.
