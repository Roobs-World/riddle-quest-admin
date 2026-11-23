# Completion storage survives ordinary game updates

The completion delivery hook constructed a Set and a Map in `useRef` arguments on every render. React retained the original collections, but evaluating those arguments still created disposable replacements. In the production hosted game, 32 native answer edits or parent updates created 32 additional Sets and 32 additional Maps. The keyboard remained the same DOM element, ruling out game remounts as the cause.

Both collection holders now use lazy state initialization. The same mutable holders survive updates, completion retries and account cleanup. A fresh game mount still creates its own storage. The committed outcome snapshot and immediate account revocation from the preceding reliability fix retain their behavior.

The regression uses the actual `PlayHostApp`, hosted session, game frame, local bridge and fake authority. A Vite fixture wraps only the two collection constructors with counters; instrumentation does not enter target artifacts. Chromium enters `pian` using native physical keyboard events, then edits it or refreshes the parent. Scenarios also hold an actual completion response across updates and retire/remount the actual game. Explicit submission must still produce one authority guess, one authority completion, one request identity and a successful game receipt.

The initial minimal reproduction failed one of ten assertions, observing two Sets and two Maps after two edits. The final captured-source comparison fails 12 of 132 assertions: every scenario and viewport still allocates on updates. Every functional and keyboard-identity control passes. The fixed production probe passes all 11 minimal assertions. The full fixed verifier passes 132 assertions in each React mode across four scenarios and three viewports. Mount counts may differ under StrictMode; ordinary updates must create zero replacement collections.

| Check | Result |
| --- | --- |
| New hosted allocation harness, both React modes | 264 assertions passed across 24 journeys |
| Committed completion regression, both modes | 564 assertions passed |
| Completion listener retirement regression, both modes | 564 assertions passed |
| Firefox captured original and fixed production game | Native virtual keyboard clicks; two edits create 2 Sets/2 Maps before and 0/0 after; same mounted keyboard and `pian` draft |
| Firefox explicit submission, both versions | One authority guess, one completion and one successful receipt identity; no browser errors or unhandled promises |
| Portal unit suite | 2,756 tests passed in 297 suites; 121 optional browser tests skipped |
| Built browser journeys | 37 tests passed in seven suites |
| Types and TSDoc | Passed; 25,265 documented declarations across 1,139 files |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | All 766 inventoried source inputs identical before and after verification |

The legacy hook mock now retains lazy state slots across explicit rerenders. Existing retry, synchronous acknowledgement, effect replay, canonical reconciliation and account isolation tests remain in the unit suite. The new verifier is registered as `test:completion-container-work:browser` and included in the game browser chain.

The measured result is reduced constructor work, not a wall-clock, heap-size or live network latency benchmark. Authority is local fake host services; purchases, rewards and identity remain server-authoritative and idempotent. YouTube was built with incomplete English fixture content, so release-content completeness is unverified. No visible product copy changed. The broader improvement goal remains active.

Both owned Firefox fixture servers stopped with pnpm exit 130 and their exact scratch directories were removed. Both owned tabs were closed, preserving the original blank tab. Serve-only shutdown output with zero automated checks is not counted as evidence.

Evidence: [verification summary](../../../../artifacts/completion-container-work-2026-10-04/verification-summary.json), [owned source diff](../../../../artifacts/completion-container-work-2026-10-04/owned-source.diff), and [asserted Firefox traces](../../../../artifacts/completion-container-work-2026-10-04/firefox-verified.json). Original/final source captures, allocation comparisons, screenshots and gate logs are retained in the same artifact directory.
