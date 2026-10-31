# Riddle-Q Jest readiness

Verification is in progress. A new client build has not been accepted by Jest yet. Review submission and publication have not been performed.

The release source is frozen in `/tmp/rq-jest-release-source-20261016`. `source-snapshot.json` records each source file hash and snapshot commit. The original working tree and its Git history are preserved, including the user's latest reward UI work.

| Check | Current result | Evidence |
| --- | --- | --- |
| Latest reward UI | Automatic reward tabs no longer block puzzle input. Confirmed coin balances and one-action Next pass the rendered game journey. | `reward-navigation-browser-final.log`, `reward-hosted-referral-final.log`, `reward-interaction-unit.log`, `reward-overlap-verification.json` |
| Architecture and target boundaries | All 61 architecture checks passed after the interaction fix. All six isolated target builds and audits passed. Required reward declaration documentation now passes, and all seven documented files emit identical JavaScript. | `reward-interaction-architecture-full.log`, `release-verified.log` |
| Unit, coverage and security rules | Core 436 tests with 100% coverage, portal 3,263 tests, backend Node 22 1,798 unit tests and 3,113 full coverage tests, plus 1,315 security-rules tests passed. | `release-verified.log` |
| Browser navigation | All 8 suites and 30 tests passed. The sweep visited 327 routes with none unvisited. | `release-verified.log` |
| Focused browser checks | All 148 commands passed, covering development and production interaction, recovery and lifecycle checks. Jest authentication, platform browser flows and timed stability stages now follow. | `release-verified.log` |
| Full release gate | Previous run stopped at retained test setup: its artifact reader ignored the configured inventory directory. The shared-path fix and tamper/cache regression passed. All3 retained browser suites passed28 tests. A fresh full release is now running from64c8014 without skip flags. No upload has occurred. | `release-verified.log`, `retained-inventory-regression.log`, `retained-race-isolated-inventory.log` |
| Premium backend | Only `syncJestSubscriptions` was deployed, as approved. Signed sandbox activation granted 3,400 once. Replay and reload granted zero. Renewal cancellation succeeded. This proof used the previously active client. | `deployment-receipt.txt`, `backend-subscription-verification.json` |
| Premium provider description | Read back the 3,400-coin benefit and cancellation description. Price remains $4.99 monthly. | `subscription-plan-after.json` |
| Sandbox users | Two distinct existing users are ready for PvP. A third isolated user is saved for fresh Premium activation on the candidate. | `sandbox-identity-comparison.json`, `fresh-sandbox-login.json` |
| Hosted candidate acceptance | Awaiting accepted upload. Chromium, WebKit, all six coin offers, Premium activation and two-user current PvP will target the exact uploaded version. | Pending |
| Jest images | Existing configured images return valid PNGs. All three library images have completed processing and passed moderation. | `provider-image-checks.json`, `provider-image-approvals.json` |
| Jest Simulator Basic Launch | Not verified. The connected automated browser cannot access the user's signed-in Developer Console profile. | Requires Console access |
| Team agreements and review self-checks | Not exposed by the available team/game connector readbacks. | Requires Console check |
| Physical mobile devices | Browser viewport and engine checks are automated. Physical iOS Safari and Android device checks remain manual. | Pending/manual |
| Temporary test access | Temporary App Check debug credential is runtime-only and excluded from source, builds and reports. It and the three private sandbox state files must be removed after testing. | Cleanup pending |

The earlier release logs contain stopped or failed attempts. They do not establish acceptance of a new candidate. `release-inventory-fixed.log` is the current release attempt. Runtime errors deliberately injected by unit tests are recorded in those test logs; use the final suite status to determine the test result.

Hosted automation uses the approved temporary App Check debug credential because automated browsers received HTTP 403 without it. These tests can verify the game, identity, and economy flows. They do not prove normal browser attestation. A regular-browser launch without the debug credential remains a manual acceptance check.
