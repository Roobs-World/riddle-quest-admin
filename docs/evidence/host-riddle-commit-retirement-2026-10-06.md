# Single-player question delivery after context replacement

An old hosted single-player question can no longer publish after its account, account generation, locale, or provider is replaced at React commit. Retired delivery waits release their loading activity immediately; late success, failure, and completed-Daily fallback cannot change the replacement board, notice, or correlated operation.

This is local implementation and verification. Nothing was deployed, committed, pushed, or uploaded. The wider reliability, performance, playability, and latency goal remains active.

## Reproduction and implementation

The first mounted React probe held a real adapter receipt and released it from a layout effect after replacement committed, before passive cleanup. All four replacement variants incorrectly accepted the old question in development and production. The same failure reproduced with stable callbacks. These logs and the exact preceding hook are retained under `artifacts/host-riddle-commit-retirement-2026-10-06/`.

The ranked hypotheses were late passive retirement, missing committed ownership checks on ordinary loads, and replaced callbacks retaining access to the shared publisher. Ordinary loads used the generation changed by passive cleanup; provider replacement was also absent from the recovery effect's dependencies. Prepared questions already had a separate committed ownership check.

The hook now owns a controller and a stable account/locale/provider scope in a layout effect. Cleanup aborts that commit's controller, and a retained old load callback cannot admit work through the new scope. Passive cleanup only removes its own recovery scheduler and listeners. It cannot abort a replacement request admitted during layout or erase that request's readiness.

Ordinary profile refreshes, optional preparation-guard identity changes, and recovery-callback changes preserve admitted ordinary requests. Recovery callbacks, profile receipts, mode, and the load implementation follow committed renders, so a suspended render cannot replace these projections. Optional preparation retains its separate admission guard. Provider replacement now starts a fresh recovery context. Existing request supersession, deadlines, retry cadence, and Daily routing remain covered.

The retirement bounds local delivery; it does not cancel or undo already admitted provider work. No server API, economy authority, visible copy, or production telemetry schema changes. No measured reduction in remote network latency is claimed.

## Verification

| Check | Final result |
| --- | --- |
| Focused lifecycle and preparation units | 77 tests / 4 suites, including five new ownership cases |
| Complete client unit run | 2,898 passed; 93 intentionally skipped; 301 passed suites and 15 skipped suites |
| New mounted ownership matrix | 396 cases / 4,620 assertions / 396 screenshots; StrictMode; Chromium 153.0.8010.12 and Firefox 153.0; development and production; three viewports |
| Full-host recovery | 60 cases / 642 assertions across both React modes |
| Full-host Classic preparation | 60 cases / 1,050 assertions across both React modes |
| Final isolated Jest and Reddit artifacts | 8 browser tests / 3 suites |
| Dedicated Facebook 13+ SDK fixture | 1 full browser journey |
| Builds and isolation | All six isolated clients, YouTube content fixture, and bundled Devvit server |
| Static checks | Client types, security, target boundaries, TSDoc, and file sizes |

The maintained native harness mounts the actual lifecycle, game frame, bridge, and native answer input. It covers late successes and failures, completed Daily both before and during Classic fallback, account/locale/provider replacement, replacement requests admitted during layout, automatic coalescing, account A→B→A, final unmount, profile updates, guard/callback changes, and suspended uncommitted replacements. Every owned playable question accepts native typing. Injecting the exact preceding implementation into the final harness fails 13 of 48 assertions across four scenarios; React scheduling suppresses the old generation receipt in that final fixture, but its retained callback still improperly admits a new read. The simpler original probe independently reproduces the generation receipt failure.

The first full unit run found six existing markup assertions expecting letters directly inside buttons. The earlier glyph-fitting work wraps letters in spans. A separate run reproduced all six failures without using the host lifecycle. Two assertions now check the letter in the correct attempt row regardless of the containing element; consumed-attempt, hint, disabled-cell, and active-cell checks remain intact. The corrected complete suite exits successfully. No production board change was made in this pass.

Retained fixture preflights include an incorrect relative import, an incomplete bridge profile, and onboarding hiding a valid heading from accessibility queries. The Firefox MCP information call still closes before returning state; native Firefox evidence is separate. A cleanup preflight expected the preceding pass's two Facebook inventories, but this default fixture produces one; nothing was removed by that failed check. A verifier preflight incorrectly expected the hosted lifecycle in standalone targets; the final assertion verifies its presence only in Jest/Facebook/Reddit and its absence from YouTube/Netflix/Yahoo.

## Evidence ownership and limits

Six before/after source records and an exact reversible patch isolate this pass from the accumulated dirty checkout. All five existing baselines match the preceding frozen manifest; the sixth record is the new maintained browser harness. The final manifest retains all 2,445 preceding inputs and adds that harness, covering 2,446 inputs. After the initial freeze, only the unrelated unit assertion file changed. All six build dependency inventories exclude it, and all runtime implementation bytes stayed unchanged across the final verification runs.

Backend/core verification is explicitly reused: 391 core units, 1,730 backend units, 677 actual SDK integration cases, and 17 pinned Node 22 cases from the preceding pass. All 824 selected authority source/configuration/compiled inputs remain byte-identical, as do 24 canonical and installed compiled core copies. The reused logs have recorded hashes. No backend emulator or Functions emit was started in this pass.

All 28 tracked test/build/check jobs reached actual terminal states. The final 1,301 built files and six target inventories are preserved with SHA-256 hashes. Cleanup verified preserved bytes before removing only the owned temporary build root and seven exact inventory files, including the Facebook fixture's one extra inventory. Browser harnesses closed their own servers and removed their scratch directories. The source manifest is unchanged after cleanup. `verify.py` checks these records, red and green assertions, reused evidence, target isolation, built hashes, and cleanup; its final run exits 0.

YouTube used fixture content, not release certification. The injected Facebook journey uses the existing synthetic gameplay host and is not a hosted server authentication certification. The previously documented malformed recorded-invitation cold-read issue remains outside this mounted hosted single-player fix.
