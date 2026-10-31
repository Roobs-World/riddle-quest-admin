# Backend route verification, 22 October 2026

All 235 Firebase suites and 3,160 tests are verified passing after the targeted fixture repairs. Core passed 40 suites and 436 tests. No tests were skipped.

The initial full Firebase run passed 229 suites and 3,149 tests, with six failed suites and 11 failed assertions. After correcting five stale test fixtures and using a valid shorter demo project for the operator CLI, all six targeted suites passed all 148 tests. The final totals replace those six original suite results once; they do not count reruns twice.

| Route group | Result | Suites | Tests |
| --- | --- | ---: | ---: |
| Jest identity and account lifecycle | Passed | 7 | 94 |
| Jest purchases, subscriptions and referral endpoints | Passed | 3 | 89 |
| Classic and Daily play, hints, skips and completion | Passed | 29 | 273 |
| Multiplayer, invitations, results and reward delivery | Passed | 118 | 1937 |
| Profiles, leaderboards, presence and social safety | Passed | 16 | 151 |

Route group counts overlap. [summary.json](summary.json) lists exact files and their final result source. [authoritative-routes.json](authoritative-routes.json) lists each concurrent-join, private-ownership, third-seat rejection and safety test.

The repaired fixtures now establish real accepted answers before expecting forfeit badges, winner coins or referrals. Duplicate deliveries preserve balances and one-time referral receipts. The Daily timeout fixture now returns the medium difficulty required by scheduled Daily generation. Production logic is unchanged.

[Initial full results](functions-results.json), [targeted results](targeted-results.json), [core results](core-results.json), and [run details](run-details.json) preserve the complete evidence. TypeScript, ESLint, TSDoc and whitespace checks passed after the fixture changes.

All server state used private local demo emulators. The emulators shut down successfully. No production data, real charges or real purchase grants were created. There are no blocked local prerequisites. Live provider billing settlement requires separate provider validation.
