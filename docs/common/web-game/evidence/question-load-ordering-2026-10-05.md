# Question load ordering — 5 October 2026

Overlapping single-player loads could replace a newer board after the player started typing. The injected browser reproduction issued two valid correlated bridge commands, held the earlier provider response, delivered the newer session, typed `C` with the native keyboard, and released the older response. Original source delivered another board and erased `C`. The minimal run had 2 failures in 9 checks; the expanded original-source matrix had 27 failures in 180 checks.

## Change

`useHostRiddleLifecycle` now gives each visible load its own delivery controller. A newer correlated load retires the earlier delivery wait immediately. Only the current controller in the current account context can publish a question, report its operation, update startup state, begin Daily-to-Classic fallback, or schedule failure recovery. The older provider operation can finish; its result and rejection remain handled.

Retiring an old startup wait releases its activity before its provider settles. Finalization removes the account-abort listener and clears refs only while they still belong to that request. Automatic ready/recovery callers continue sharing the active read. Silent Classic preparation remains outside visible delivery ownership.

This pass changes the host lifecycle, its recovery tests, and a registered development/production browser verifier. Existing work in the shared checkout is preserved. No visible product text, locales, provider permissions, commerce grants, or deployments changed.

## Reproduction and controls

The real PlayHostApp, hosted session, schema routers, game message hook, reducer, keyboard, and board run around injected provider responses. The browser fixture does not use a production backend.

```sh
pnpm --dir packages/portal exec node scripts/verify-question-load-ordering-browser.mjs
```

`QUESTION_ORDER_BASELINE_DIR` can substitute the captured original lifecycle (`artifacts/question-load-ordering-2026-10-05/lifecycle.before.txt`) in the Vite fixture. `QUESTION_ORDER_REPORT_DIR` selects a separate evidence directory. That substitution leaves the final fixture and the rest of the current source unchanged. The minimal red command used `QUESTION_ORDER_QUICK=1 QUESTION_ORDER_SCENARIOS=late-success`.

The passing matrix covers late success, late failure, unmount retirement, old success while the new read is still pending, obsolete reconcile, and obsolete Skip-preview loads. It runs at 390×568, 390×844, and 1280×844 in development and production React StrictMode. Each run rejects external traffic and checks browser errors and unhandled rejections. The final matrix passed 360 assertions.

Six new unit cases exercise the actual lifecycle and its delivery boundary: board/draft preservation through the real parsed game bridge, prompt release of old startup activity, latest failure recovery, both Daily fallback boundaries, and automatic-read sharing. The first unit fixture needed required riddle fields and a content-only bridge envelope to reach the parser/reducer seam; the valid original-source test then failed because the superseded delivery returned true. Production browser checks use the complete real host messages and profile.

The ranked hypotheses were missing host ownership, same-session reducer refresh behavior, and cold-parser ordering. The warm bridge and distinct session IDs ruled out the latter two in this reproduction. Adding per-request host ownership made the original loop green.

## Verification

| Check | Result |
| --- | --- |
| Ordering browser matrix | 360 assertions passed |
| Related Classic preparation | 1,050 assertions passed |
| Related paid Skip/rollback | 840 assertions passed |
| Firefox native input | `C` survives old success; `CL` survives obsolete failure; no errors, alerts, extra recovery reads, or extra deliveries |
| Focused lifecycle/preparation unit tests | 55 passed |
| Full portal unit tests | 2,828 passed in 300 suites; 93 browser-gated tests skipped in 15 suites |
| Types and TSDoc | Passed; 25,478 declarations across 1,144 files |
| Six isolated target builds and artifact audits | Passed: Jest, Facebook, Reddit, YouTube fixture, Netflix, Yahoo |
| Built browser tests | 8 passed in 3 suites; unchanged 100 ms buffered transition assertion passed |
| Source capture | Same re-enumerated 1,513 selected inputs and SHA-256 hashes before/after verification |
| Preserved builds | 1,300 files; copied hashes match the private build outputs |

YouTube was verified as an incomplete-content fixture, not a release certification. These injected tests prove client delivery ordering and recovery behavior; they do not measure live-provider network latency or imply cancellation of admitted backend work.

All owned processes reached terminal status. Private build output and six owned dependency-audit directories were preserved and removed, the Firefox fixture cache was removed, and the owned Firefox tab was closed. The remaining Firefox page is the pre-existing blank page. The first cleanup script parsed a trailing server-summary line as the fixture URL and failed after removing the build outputs; corrected cleanup read the URL record and verified the completed removals.

The machine-checked summary, raw observations and logs, source captures, owned diff, artifact hashes, native Firefox records, and cleanup ledger are under [the evidence directory](../../../../artifacts/question-load-ordering-2026-10-05/verification-summary.json). The broader game-improvement goal remains active.
