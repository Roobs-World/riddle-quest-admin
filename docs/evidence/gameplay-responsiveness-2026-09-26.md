# Gameplay responsiveness — 26 September 2026

The active Jest version still requires confirmation in the authenticated Developer Console before attributing a live report to any specific build. On 26 September, Jest accepted the gameplay build `1.0.0-dev.20260926143718.d1d925e79274.7477702f` as an inactive draft (version ID `01a0de36-f6f2-711c-9ecd-8897081f16b1`). HTTP 202 reported processing, not readiness or activation.

## Measured local behavior

The injected Jest harness ran at 390 × 844, DPR 2, four reported logical cores, 4 GiB reported memory, and 4× CPU throttling. The reusable command is `node packages/portal/scripts/measure-game-screens.mjs`; the raw result is in `gameplay-responsiveness-2026-09-26.json`. Measurements below use the isolated `dist-jest` release build, not a live Jest server. Cold gameplay data and enabled keyboard were ready in 438 ms. Each warm opening has seven samples; p95 uses the nearest-rank method.

| Screen | Cold opening | Warm opening p95 | Data/control readiness |
| --- | ---: | ---: | --- |
| Profile | 318.9 ms | 9.9 ms | Profile snapshot and controls available on opening |
| Settings | 23.7 ms | 10.3 ms | Controls available on opening |
| Shop | 11.4 ms | 9.9 ms | Product catalog available on opening |
| Race categories | 18.8 ms | 10.5 ms | Category controls available on opening |
| Hint / Skip | 10.1 / 10.6 ms | 10.9 / 10.7 ms | Confirmation controls available on opening |
| Statistics / Achievements | 6.2 / 7.2 ms | 6.0 / 6.6 ms | Local profile data available on opening |
| Treasure / Ranks | 4.7 / 5.1 ms | 12.6 / 6.6 ms | Controls and rank data available on opening |
| Help / Credits / About | 5.6 / 6.0 / 4.0 ms | 7.9 / 7.0 / 7.2 ms | Content available on opening |
| Leaderboard | 10.0 ms | 10.6 ms | Cold data 279.2 ms; warm cached ten rows visible on opening while refresh p95 was 268.6 ms |

The leaderboard measurement exposed that the existing read-only rows were hidden during refresh even though the reducer retained them. The page now displays those rows with `aria-busy` until fresh data arrives. It does not use cached values to authorize spending. The notification surface on Jest is a host scheduling/lifecycle feature rather than a separate in-game screen; its interaction is covered by the Jest notification tests.

With host responses withheld, 25 solo feedback samples had p95 12.9 ms, five buffered Classic transitions had p95 40.1 ms, and five opt-in Race feedback samples had p95 13.3 ms on the same throttled profile. The flow advanced to the second issued Classic question before the first confirmation, submitted its answer, drained the ordered journal, restored the confirmed question after a synthetic definitive rejection, and replayed the identical pending request ID after reload. The backend tests cover legacy Race redaction and opt-in current-answer exposure.

## Release boundary

The compatible backend was deployed first to Firebase project `riddle-quest-ec2b2`: `getClassicRiddleBuffer` was created and `startRaceRun`, `submitRaceGuess`, `requestRaceHint`, `skipRaceRiddle`, `resumeRaceRun`, and `redditGameplay` were updated. Firebase listed all seven as `ACTIVE` in `us-central1`. Unauthenticated POST probes of the new buffer, legacy Classic, and Race resume callables each returned HTTP 401 with the expected `UNAUTHENTICATED` envelope. The authenticated success path was checked with backend contract tests, not a live production account.

The six isolated client builds passed their artifact audits and were packaged as local candidates under `.firebase/client-candidates/2026-09-26-gameplay/`. `SHA256SUMS` verifies all six ZIPs; each archive also passed `unzip -t`. Jest, Facebook, Reddit, YouTube, and the Netflix/Yahoo standalone injected browser harnesses passed. The Jest release ran the extended production gate, including its ten-minute mobile soak, then rebuilt and tested the exact uploaded ZIP. Jest accepted that ZIP (2,762,862 bytes; SHA-256 `6093143cd35e61f4bd5759502e811c3c4dae659094f0dc9cdfcc849cd85bd968`) from clean source commit `d1d925e7927489e7b8312ed522053093eda78bd3`. The owner-private receipt records `activationRequested: false`, `buildStatus: processing`, and `readiness: pending`. The other five client candidates remain local.

The local harness cannot establish production network p95, the currently active Jest build, or partner certification. Jest MCP status lookup failed because its OAuth token could not refresh. Before activation, confirm that the new version finished processing in the Developer Console or build-completion email, run its registered sandbox, and repeat cold/warm timing with real authenticated traffic and a representative mobile device. The upload did not request activation or public publication.
