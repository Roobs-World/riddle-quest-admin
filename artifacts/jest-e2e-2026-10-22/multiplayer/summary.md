# Multiplayer and referral verification, 2026-10-22

This evidence uses current-source component browser harnesses with an isolated local Firestore emulator, plus a separate retained-controller test artifact. It does not claim two-player end-to-end coverage on the immutable canonical Jest bundle or actual message delivery. Root owns hosted observations and platform_audit owns canonical authentication/general browser suites.

## Fixed coverage gate

The explicit integration inventory omitted raceLivePublicWait.it.test.ts and raceLiveStreamAdmission.it.test.ts from firebase-functions/jest.rules.config.js. Only those two testMatch entries were added, preserving the pre-existing progress reporter. The inventory audit now passes: 19 Playwright suites and 94 emulator suites reachable. The restored suites pass 28 tests against private Firestore on 127.0.0.1:19799. Direct backend TypeScript compilation and JavaScript syntax checks pass. No backend deployment occurred.

## Results

| Journey | Result | Evidence level and file |
| --- | --- | --- |
| Public matching, wait beyond old bot timeout, exact reload seat, offline/reconnect and synchronized answers | PASS at 390/1280 px | Real local authority through injected HTTP transport; public-match/evidence.json and public-match-browser.log |
| Private lobby creator reload, native share cancellation/failure/retry, incoming invitation alert and direct username acceptance | PASS at 390/1280 px | Real local authority and mocked platform share delivery; invitations-browser.log and invitations/ |
| Public concurrent joins, exact-resume ownership/TTL/replacement, no bot fallback | PASS | Restored integration suite, included in 28 tests; restored-integration-results.json |
| Private invitation third-seat/concurrent acceptance, exact ownership, settlement idempotency and rematch provider boundaries | PASS, 74 tests across 3 suites | Real Firestore authority; authority-boundary-results.json (its separate safety setup failure is preserved) |
| Block/report authority, privacy-safe responses and presence revocation | PASS, 9 tests after required RTDB setup | Real Firestore + RTDB authority; authority-safety-rerun-results.json |
| Stream admission cap, abort cleanup, replacement lease and expiry | PASS | Restored integration suite, included in 28 tests; restored-integration-results.json |
| Cancelled lobby rendering and return navigation | PASS, 12 cases | Source component with synthetic transport; cancellation-browser.log |
| Rematch ownership across provider changes, abandonment and commit | PASS, 27 scenarios / 426 assertions | Production-mode source component with synthetic transport; rematch-owner-browser.log and rematch-owner/observations.json |
| Full live gameplay, multilingual input, hints/skip/exhausted guesses, reload, progress, finish penalty and settlement | PASS, both two-player desktop/mobile rounds and same-seat human waiting beyond old bot deadline | live-race-browser-final.log and live-race-final/ |
| Retained Race entry/recovery/quit compatibility | PASS, 28 unique cases across initial run + targeted rerun | Isolated retained test artifact from frozen persistence source; retained-race-final-union.json; initial and targeted logs preserved |
| Referral selection and batching | PASS, 49 tests | Backend unit cases including conversion 21 and paging beyond 500 existing receipts; referral-selection-results.json |
| Signed backend transport/deadline handling | PASS, 13 tests | Portal unit cases; referral-transport-results.json |
| Failed referral grant before commit, later reconciliation, and three concurrent post-commit replays | PASS | Separate private demo project; one receipt and one reward per wallet; referral-replay-emulator.log |

## Failures preserved and minimal harness corrections

The initial live-game harness failed at its old wallet expectation: expected [150,100], actual [200,125]. Current server policy correctly adds 25 coin race_debut to both players and 25 coin race_first_win to the winner, alongside the 50 coin match reward. The test now checks exact balances and achievement IDs: desktop [200,125] with Alice race_debut+race_first_win and Bob race_debut; mobile [125,225] with Alice race_debut and Bob race_debut+race_first_win+race_clean_run. This is a test-only change; canonical artifact bytes and production gameplay were not altered.

The first targeted rerun passed both two-player rounds and then timed out at an old trailing fixture expecting a bot after 60 seconds. Modern public wait deliberately remains searching for a human. The bounded repair replaced only the real-emulator bot expectation with same-seat public-human-wait assertions; synthetic bot-layout coverage remains separate. The final failed-harness rerun passed both two-player rounds, the new same-seat public-human-wait assertion, retired-link navigation and missing-live-capability handling. Its local emulator session exited 0; see live-race-browser-final.log. No unresolved stale live-game expectation remains. Original failures are in live-race-browser.log and live-race-browser-rerun.log. Run manifests preserve commands, outcomes and timings in emulator-stage-results.json and focused-emulator-rerun-results.json.

## Canonical coverage gap

Existing full-game liveMultiplayer/liveRematch support is typed and wired for Facebook/Reddit provider envelopes. The Jest authentication harness deliberately disables live matchmaking. Those helpers cannot directly run two authoritative players against the canonical Jest bundle without a new auth/provider harness. No new framework was created. Source-component/emulator evidence above is supplemental; actual hosted public wait/cancel/private lobby and canonical browser coverage are reported separately by root/platform_audit.

## Hosted transient warnings and referral recovery

See referral-and-hosted-transport-assessment.md and hosted-cold-start-timings.json. Earlier Simulator referral timeout aligns with a CORS preflight that outlasted the 15 second client budget and preceded any POST. Later hosted requests completed. The observed hosted public-search error aligns with the 2 second poll deadline during a roughly 7 second cold preflight and recovered automatically before manual Retry. Neither is reported as a clean first-attempt success. No deadline, capacity or retry behavior changed.

A failed referral call does not consume a conversion. Registered startup/remount fetches a fresh provider list; backend wallet and durable receipt writes are atomic and replay-safe. Eventual reconciliation depends on the player returning and Jest continuing to list the conversion. No claim of permanent provider-side retention or actual referral message delivery is made.

## Additional authority setup correction

The first authority batch passed live 43 + invitation 13 + rematch 18 = 74 tests. Its nine safety cases failed at the suite setup guard because my initial invocation omitted RTDB. No safety test body ran. I added only the required local RTDB emulator configuration in /tmp and reran only safety: all nine passed. Both JSON reports and logs remain. Together with the restored public-wait/stream suites, the final union is 111 passing real-authority tests across six suites; this is not a duplicate full backend run.

## Retained compatibility geometry mismatch

The first retained run passed 27 of 28 cases. One sharing journey stopped at retainedRaceRecovery.jest-playwright.test.ts:432 because it compared the bottom-row Backspace width (45.875 px) to a top-row letter width (36.5 px). Current keyboard rows fill their available width with equal-flex keys; fewer keys on the bottom row make all keys in that row wider. The test-only repair now compares Backspace to a letter in the same row while retaining existing style and full-width assertions. The single failed sharing case passed on its targeted rerun (18 other cases were deliberately filtered out). Combining the initial 27 passes and this 1 repaired case gives 28 unique passing cases across the three retained suites. No unresolved stale geometry expectation remains. No runtime/CSS defect was found. Original result and failed assertion remain preserved.

A preliminary referral replay command started after the first emulator had shut down and was interrupted before any assertion (exit 130). That orchestration error is recorded in referral-replay-preliminary-attempt.log; the replay proof ran later inside its owned emulator lifecycle.

## Final result

Both diagnosed test-only expectations are repaired and their failed paths pass. JavaScript syntax and diff whitespace checks pass. No production game code or canonical Jest artifact was changed by these fixture repairs; root separately owns the persistence fix and its fresh canonical build/upload. Backend deployment was not performed. The synthetic bot-layout branch remains intact and was not rerun because only failed paths were requested.

The initial and targeted retained artifacts contain 416 runtime files each, with identical paths and SHA-256 hashes for every file. Source-digest changes came from the test edits; runtime bytes did not change. See retained-artifact-comparison.json. Final failed-path commands/results are in final-failed-path-results.json; exact test-only diffs are in test-only-repairs.patch.
