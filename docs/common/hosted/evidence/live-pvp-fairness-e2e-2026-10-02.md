# Live PvP fairness and end-to-end verification — 2026-10-02

Live PvP retains server-owned matchmaking, immutable questions, answer validation, progress, finish order and the single 50-coin reward. This follow-up fixes early question exposure, contaminated question state after skipping, and unenforced help penalties. Changes are verified locally; they have not been deployed.

## Reproduced defects and fixes

- Countdown responses exposed the first prompt before the shared start. Both viewers now receive no prompt until the server start boundary. Scheduled response validation permits this empty state only with an authoritative start and observation clock; early scoring remains invalid.
- Skipping after nine actual solves could retain guesses and hinted letters from the previous question. Exhausting guesses could also produce an invalid response. Live normalization now clears that state when advancing, preserves nine solved points, and requires a tenth correct answer before victory.
- Hint and skip penalties changed the displayed timer without delaying competitive actions. The server now derives an action deadline from its own accepted events: 15 seconds after a hint and 45 seconds after manual or automatic skipping. Guess, hint and skip commands before that deadline are rejected. Polls, terminal settlement, command replays and leaving remain available. Typing stays usable during the wait.
- A fractional timeout could fire just before the help deadline, leaving the last second locked during a polling outage. A bounded monotonic timer keeps the visible wait current and checks until the deadline is reached. It stops at expiry or cleanup.
- The initial wait message fell outside the fitted mobile viewport. It now uses the existing gameplay status area; the browser regression asserts that the whole message remains visible.
- Failed avatar requests now display a stable placeholder while preserving the username. Both self and opponent fallback paths are exercised with an actual injected 404.

The live authority integration suite is included in the emulator-backed rules test configuration. Added regressions also exercise provider/language/category pool isolation and active block/deletion boundaries, which retire a match without a forfeit reward or exposed rival identity.

## Verification

All receipts and screenshots are in `artifacts/live-pvp-fairness-e2e/`.

| Check | Result |
| --- | --- |
| Real service with Firestore emulator, 1280px and 390px | Intro, centered lobby, five-second countdown, withheld prompt, live rival progress, hint wait, manual/automatic skip at nine solves, immediate tenth-answer win and stored balances of 150/100 pass |
| Seat recovery with removed catalog, both widths | Both players recover the immutable match and settle exactly one 50-coin grant |
| Server authority integration | 30 tests pass, including simultaneous finishes, exact bot deadline, replay, command ownership, privacy, clock corrections and penalty boundaries |
| Private Firestore rules | 5 tests pass; authenticated and anonymous browser reads/writes of live authority records are denied |
| Core schemas and rules | 283 tests pass |
| Client regression suites | 87 tests pass |
| Backend engine, transport and failure regressions | 69 tests pass |
| Database round-trip regressions | 4 tests pass |
| Injected browser faults, both widths | Hung joins/polls, superseded replies, late/lost commands, reconnect, bounded outage backoff, cross-tab rejection and terminal quietness pass |
| Known help deadline during poll outage, both widths | Draft survives, submission is disabled before expiry and resumes without another successful poll; wait text stays inside the viewport |
| Lifetime and device clocks | Ten unmount and ±1-hour clock-change cases pass |
| Isolated artifacts | Jest, Facebook, Reddit, YouTube, Netflix and Yahoo builds and artifact audits pass |
| Reddit package | Build and 42 package checks pass; browser traffic remains same-origin and the server gateway retains its single approved host |
| Maintenance | Functions build, focused server lint, file-size and scalability audits pass; focused live-feature TSDoc passes |

The repository-wide TSDoc run reports missing comments in concurrent authentication, profile, classic supply and notification work. It reports none in the runtime files changed for these fairness fixes. No changes from those other tasks were reverted.

## Reproduction

```sh
# Real service, Firestore authority, recovery and browser-denied private records:
LIVE_RACE_USE_EMULATOR=1 pnpm --dir firebase-functions exec firebase emulators:exec \
  --config ../artifacts/live-pvp-fairness-e2e/firebase.json --only firestore \
  --project demo-riddle-quest-live-fairness \
  'node ../packages/portal/scripts/verify-live-race-browser.mjs && node ../packages/portal/scripts/verify-live-race-seat-recovery-browser.mjs && pnpm exec jest --config jest.rules.config.js --testMatch "**/raceLive.it.test.ts" --runInBand && pnpm exec jest --config jest.config.js --testMatch "**/raceRules.it.test.ts" --runInBand'

# Penalty deadline and viewport regression with a polling outage:
LIVE_RACE_COOLDOWN_ONLY=1 node packages/portal/scripts/verify-live-race-delivery-browser.mjs
```

Baseline failing runs are retained in `fairness-baseline.log`, `penalty-baseline.log`, `cooldown-baseline.log` and `cooldown-layout-baseline.log`. Final browser receipts are `browser-authority-final.log` and `cooldown-browser.log`; the full server and recovery receipt is `authority-e2e.log`. Local transport measurements do not establish production latency.
