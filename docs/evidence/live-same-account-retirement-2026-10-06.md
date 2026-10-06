# Same-account live race retirement ownership

Old multiplayer cleanup can no longer forfeit a canonical seat reclaimed by a newer explicit join from the same authenticated account. A server-owned join receipt now binds each retirement to its original join, and the existing leave transaction checks that claim before changing gameplay or rewards.

This pass is local implementation and verification. It does not deploy a provider backend or certify a hosted release. The wider reliability, performance, playability and latency goal remains active.

## Reproduction and cause

The mounted `RaceTo10Game` harness uses two capability objects for one explicit account and one canonical server seat. It reproduces both a committed join whose response arrives after provider replacement and an old leave already in flight when the replacement joins. Reusing the canonical ticket is intended existing server behavior; ticket-only cleanup could therefore cancel the replacement journey.

The first control failed four gameplay assertions. The final harness, injected with the exact preceding implementation, failed eight of eighteen assertions across both scenarios, including the cancelled server seat, missing editor and inability to submit the replacement answer. These are retained in `red/`, `red-final.log` and the frozen baseline snapshots. The authority counterpart uses actual Admin SDK transactions rather than the browser fixture's simulated server.

The ranked hypotheses were canonical ticket reuse, leave commands lacking original-join ownership, and capability replacement being mistaken for account replacement. The first two explain the reproduced failure together; a new JavaScript object does not establish a new authenticated account.

## Resulting behavior

- Approved adapters opt into retirement-aware joins. The authenticated user subtree records immutable selector binding, the original accepted ticket and a durable retirement marker. The ticket carries the newest accepted join claim.
- An old join retry observes its original receipt and cannot reclaim a newer claim or follow a newly allocated active pointer. Retiring an intent before its join commits prevents late publication.
- Retirement first durably marks the original intent, then invokes the existing leave authority with a server-only claim condition. A newer claim returns a strict `superseded` acknowledgement without touching ticket, match, signal or account versions. Actual owned forfeits retain existing settlement, achievements and referral behavior.
- A captured expected account is only an authentication precondition. It cannot select another user's receipt or ticket, including after the Firebase or Reddit identity changes.
- Mounted cleanup can retire an intent before any ticket response exists. Duplicate late receipts coalesce. Recovery retains the original method, request and account; it has four attempts, 1/2/4-second backoffs and ten-second local delivery deadlines. Unknown failures never trigger an unconditional leave fallback.
- Legacy injected capabilities retain the existing bounded ticket leave path. Legacy clients do not gain the new ownership fence merely because the server supports it.
- Reddit retirement stays under the same-origin `/api/game/race.live.retire` route and the approved signed Devvit gateway. Safe authority errors survive both server and browser boundaries, including a definitively missing original seat.

The account subtree is already recursively deleted by account deletion. The new receipt collection has a seven-day TTL override. Its schema and strict acknowledgement expose no rival identity, answers, ticket selector or economy authority. New joins overlap the additional receipt read with the existing initial transaction reads. No reduction in production network latency is claimed; the fix adds persistence to establish ownership.

## Verification

| Check | Final evidence |
| --- | --- |
| Core unit suite | 391 tests / 39 suites |
| Backend unit suite | 1,730 tests / 138 suites |
| Actual SDK integration selection | 677 tests / 38 suites; owned Firestore and Database emulators; actual exit 0 |
| Pinned Functions runtime | Node 22.23.1; 17 retirement SDK cases; actual exit 0 |
| Focused client contracts | 127 tests / 6 suites, including 66 retirement, deadline and invitation cases |
| Devvit server tests | 51 passed |
| New same-account mounted cases | 24 cases / 216 assertions, Chromium and native Firefox 153.0, development and production, three viewports |
| Legacy mounted cleanup | 168 cases / 3,000 assertions on the same browser/mode matrix |
| Invitation confirmation | 27 cases / 369 assertions |
| Active close recovery | 6 cases, including lost response and request failure; additionally replayed mounted PvP, IME and polling journeys |
| Built Jest and Reddit flows | 8 tests / 3 suites against final isolated build bytes |
| Injected Facebook SDK flow | 1 full browser journey against its dedicated 13+ artifact |
| Build outputs | All six isolated client artifacts, YouTube content fixture, plus bundled Devvit server and production Functions emit |
| Static checks | Core, portal, Functions and Devvit types; Functions lint and module cycles; security, target isolation, deployment-script, scalability and E2E coverage checks |
| Documentation and sizes | 26,525 declarations across 1,188 files documented; 1,265 source files within enforced size limits |

The SDK cases cover superseded public/private/matched seats, original-join replay, retirement before publication, active-pointer replacement, reward/signal replay, changed authentication, foreign-account request reuse, recovery after the marker commits but leave fails, immutable selectors, malformed retained content, accepted invitation recovery, missing original tickets and account deletion. Four actual signed Reddit gateway cases exercise the signature, nonce, quota, identity, callable and retirement dispatch together.

The Facebook journey intentionally uses the existing synthetic gameplay host account (`jest-guest`) while testing native provider identity exchange separately. Its assertion proves that the target adapter carries the gameplay owner's precondition; it is not a real hosted server authentication test. The actual SDK cases independently verify that a mismatched authenticated actor cannot mutate either account. The Firefox MCP information call still exits before returning browser state; native Firefox harness results are separate evidence.

Two initial SDK probes are not counted as successful runs: one expected only the race win instead of the existing first-win achievement bonus, and both encountered a decoder error after Jest module teardown. The corrected fixture drains its owned original SDK read promises before teardown, keeps actual SDK results and transactions intact, and exits cleanly. No force-exit or hidden infrastructure failure is used.

Retained resolved preflights also include the missing default Firefox 1543 executable, outdated endpoint/region and rematch expectation lists, getter documentation, generic Reddit retirement errors, and an incorrectly named supplemental output variable. The latter invocation passed but wrote the existing default leave-recovery artifact directory; the final six-case run uses the exact supported output variable and this pass's owned directory. A metadata preservation search initially used the browser cache instead of the actual custom inventory directory; it removed no files.

## Evidence ownership and limits

Evidence is under `artifacts/live-same-account-retirement-2026-10-06/`. `owned.diff` and 28 exact before/after source records distinguish this pass from the accumulated dirty checkout. Baselines are checked against the preceding frozen manifest; the Devvit allowlist baseline is proved by its exact one-line change. The manifest covers 2,445 inputs, retaining all 2,390 preceding inputs and adding seven source files plus 47 existing Devvit inputs and the canonical emulator test configuration to the verification scope. Twenty-four compiled race module copies match their canonical core outputs.

Launcher and browser-support corrections after the first freeze are explicitly retained as candidate manifests. Final build inventories prove that the last support-only correction is excluded from all six artifacts. All 23 newly registered emulator suites were already included in the fresh passing 38-suite SDK selection; actual Jest selection now includes all 86 integration suites. The complete 86-suite configuration was not re-executed in this pass. The server/core runtime input sets stayed unchanged while the SDK runs were active. The final source manifest is compared again after all owned work terminates.

Both the first and final seven-output build sets are preserved, with 1,301 files each. Production Functions compilation also passes; its 394 emitted files are preserved separately after removing test and mock outputs, and its owned temporary output directory is removed. The final set has six preserved target dependency inventories. Two additional inventories belong to the Facebook harness's own temporary artifacts; that harness removes its own directories after closing. Cleanup checks preserved bytes and hashes before removing only this pass's temporary build root and exact metadata files, and confirms the five owned emulator ports are closed.

The protocol requires the new server callable, approved Devvit route and Firestore TTL configuration before updated clients are released: older strict servers reject the opt-in join fields. No deployment, upload, commit or push occurred. YouTube used fixture content, not release certification. The previously documented malformed recorded-invitation cold-read issue remains outside this live-game fix.
