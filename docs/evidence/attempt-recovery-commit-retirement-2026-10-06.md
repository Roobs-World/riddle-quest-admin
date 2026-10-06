# Continuation ownership after account, question, or provider replacement

Unresolved single-player continuation work no longer locks a replacement account's or provider's controls. A retired completion cannot apply its balance, grant an extra attempt, publish a failure notice, or unlock a newer request. Facebook remains the only target that can supply the rewarded continuation capability.

This pass implements and verifies a local client fix. Nothing was deployed, uploaded, committed, or pushed. The wider reliability, performance, playability, and latency goal remains active.

## Reproduction and cause

The initial mounted React probe uses the actual continuation hook, game reducer, and translated continuation controls. It starts an unresolved provider operation, commits an account, account-generation, or provider replacement, and tries the replacement action before settling the old provider. All three scenarios leave the new controls disabled and admit no new request. The provider-only scenario also applies the old 900-coin receipt and grants the replacement modal's extra attempt. Development and production probes both fail.

The ranked hypotheses were component-wide busy state, incomplete ownership checks on receipts, and old finally handlers unlocking newer work. The existing hook kept one busy flag across account and provider replacement. Its completion checks compared UID and question identity, but not account generation or provider ownership, and its mounted flag retired only during passive cleanup.

The hook now owns one request in a committed account-generation, locale, question, modal, provider, and dispatch scope. Layout cleanup aborts that local wait. New ownership starts with usable controls; a retained old callback cannot admit provider work through the new scope. Success, failure, and finally cleanup all check the exact request owner. A concurrently confirmed paid continuation cannot be granted again locally.

The game frame passes its rendered state to the hook, which observes it after commit. Profile updates preserve admitted work, and suspended renders cannot replace the committed account or profile used by an accepted receipt. Targets without a continuation capability do not allocate a provider-wait controller. Existing translated notices, server grant validation, provider cancellation, and retry receipts are retained.

Local retirement does not cancel an ad, undo an admitted server action, or change the authority's idempotency policy. The original provider promise remains observed, including late rejection. No short timeout is imposed on an actively owned video. No reduction in remote network latency is claimed.

## Verification

| Check | Final evidence |
| --- | --- |
| Complete client unit suite | 2,898 passed; 93 intentionally skipped; 301 passed suites and 15 skipped suites |
| New mounted continuation matrix | 468 cases / 5,568 assertions / 468 screenshots |
| Browser runtime matrix | StrictMode; Chromium 153.0.8010.12 and Firefox 153.0; development and production; three viewports |
| Mounted question-delivery controls | 24 cases / 282 assertions across both React modes |
| Final isolated Jest and Reddit artifacts | 8 browser tests / 3 suites |
| Dedicated Facebook 13+ SDK fixture | 1 full browser journey, including rewarded continuation |
| Builds | All six isolated client targets, YouTube content fixture, and bundled Devvit server |
| Static checks | Client types, target boundaries, security, TSDoc, and file sizes |

The maintained continuation harness uses native buttons, the actual hook, game reducer, continuation page, guess board, and keyboard buttons. Its 39 scenarios cover account/generation/provider/question/locale/dispatch replacement; modal reopening; account A→B→A; provider removal; final unmount; old success, failure, unavailable, and cancelled responses; ordinary profile updates; suspended provider/profile renders; and active success/failure/cancellation controls. It checks immediate local settlement while the underlying provider remains unresolved, synchronous admission deduplication, retained callback rejection, suppression of old economy/attempt/notice actions, and preservation of a newer pending request. Every resulting playable board accepts native keyboard-button input.

Injecting the exact preceding hook into the final maintained fixture fails 18 of 37 assertions across the original three scenarios. The minimized original probe also passes again in both React modes after the fix. The baseline harness's first expanded attempt waited for an editable board that the reproduced bug could never restore; that timeout is retained as a fixture preflight. The corrected baseline records the failed board assertion without waiting for the impossible transition. A keyboard fixture prop was also corrected to its actual backspace callback before the final source freeze.

The built Facebook journey independently exercises the actual target adapter, provider cancellation, no fill, held video, authoritative grant failure and retry, idempotent request reuse without replaying the video, locked conflicting controls, and the restored extra-attempt board. It uses the existing synthetic gameplay host and is not a hosted server authentication certification. Firefox evidence comes from the native harness; the previously failed Firefox MCP information call is not treated as browser verification.

## Evidence ownership and limits

Evidence is under `artifacts/attempt-recovery-commit-retirement-2026-10-06/`. Four exact source records and a reversible patch cover the continuation hook, its game-frame call site, browser command registration, and the new maintained harness. All three existing baselines match the preceding frozen manifest. All 2,446 preceding inputs are retained, with the new harness bringing the final manifest to 2,447 inputs. No source changed after freezing; build, runtime, and terminal manifests match.

Authority verification is explicitly reused: 391 core units, 1,730 backend units, 677 actual SDK integration cases, and 17 pinned Node 22 cases from the same-account retirement pass. All 824 selected authority source/configuration/compiled inputs remain byte-identical, as do 24 canonical and installed core copies. Reused evidence logs have recorded hashes. No backend emulator or Functions emit was started in this pass.

All 17 tracked test/build/check jobs reached actual terminal states. The final 1,301 built files and six target inventories are preserved with SHA-256 hashes. Cleanup verifies preserved bytes before removing only the owned temporary build root and seven exact inventory files, including the Facebook fixture's extra inventory. Owned browser servers close and scratch directories are removed. The final verifier checks source baselines and hashes, red and green assertions, actual browser versions, isolated provider dependencies, preserved outputs, reused authority evidence, and cleanup; its terminal run exits 0.

No Facebook ads implementation enters Jest, Reddit, YouTube, Netflix, or Yahoo. YouTube uses fixture content, not release certification. The previously documented malformed recorded-invitation cold-read issue remains outside this mounted continuation fix.
