# Pending-play scope and early Skip delivery

On 6 October 2026, two hosted single-player failures were reproduced and fixed. A queued retry could acquire a new account's lease and send the previous account's action during replacement. Separately, a successfully issued Skip successor could remain hidden while its paid receipt was delayed. The fixes preserve the original player's durable queue, admit only a correlated next question, and retain the existing receipt settlement and rejection rollback.

This is verified progress within the continuing multiplayer and single-player reliability, performance, playability and latency goal. It does not complete that wider goal or deploy the accumulated checkout.

**Scope failure.** The original native-browser probe mounts the real `useProvisionalPlayRecovery`, reducer, controlled board and keyboard, and the production journal/lease implementation backed by browser localStorage. Only the clock boundary is controlled. After Alice submits a native keyboard guess, a captured lease callback runs at the account-replacement commit boundary, before passive queue cleanup. Both React modes recorded Alice's issued session being sent again while Bob was the current account. There were no browser errors or replies that could explain a rewritten request.

The ranked hypotheses were scope/journal divergence before cleanup, account lease-key collision, and reply reconciliation. The maintained regression records the actual lease acquisitions and holds replies. The captured baseline acquires `Bob:1:en`, `Alice:2:en`, or `Alice:1:fr` for an action still belonging to the original journal. This confirms the first hypothesis and separates it from the other two.

The sender now checks that `journalRef.current.scope` matches the render-time account-generation-locale scope **before** acquiring a lease or posting the message. The originating journal remains durable. Same-account profile updates and question changes still allow the intended idempotent retry; logout and UID, generation or locale replacement revoke it. No retry cadence, request ID, storage format or server action changed.

**Skip failure.** Expanding the built-game smoke suite exposed an existing failure: “shows a purchased hint and the buffered Skip successor before server confirmation.” The card was absent for more than one second while the Skip receipt was held. A direct DOM/bridge probe reproduced it against both the initial build in this pass and the preserved previous checkpoint-recovery build, proving that it predates the new scope check.

The host's accepted Skip successor load superseded the optional preview load. The game received the accepted successor but retained it until the separate Skip receipt arrived, leaving the loading surface visible. The heading-selector hypothesis was ruled out: neither heading nor card existed. The maintained test was not edited or weakened.

The game now displays an early accepted successor only when its request ID matches the pending Skip, its journal still belongs to the current scope, its mode is Classic, its index is exactly the originating issued question's next index, and its session token differs from the predecessor. The predecessor may be a provisional journal successor; the check uses that exact segment. A scope replacement revokes correlated Skip replies before passive cleanup. Duplicate early loads do not reload the current question or erase its draft. The separate paid receipt still supplies the authoritative balance, clears the journal, and invokes the existing rejection rollback when necessary. Paid actions and later submissions continue to wait for settlement.

In the focused built-game trace, the successor appeared in **5.6 ms** with the Skip receipt still held, compared with no card after **1,000 ms** before the fix. This is a local fixture observation under a held bridge receipt, not a production network benchmark or percentile claim.

The production edits are confined to [useProvisionalPlayRecovery.ts](/home/craig-beswetherick/Documents/riddle-quest/packages/portal/src/play/game/hooks/useProvisionalPlayRecovery.ts). The other two owned source records add [the maintained retry regression](/home/craig-beswetherick/Documents/riddle-quest/packages/portal/scripts/verify-pending-play-scope-retirement-browser.mjs) and register it in the portal package and aggregate browser command. There is no new visible production text, provider SDK, authority API, fallback storage, price, grant or purchase path.

| Final validation | Evidence |
| --- | --- |
| Retry scope matrix | **336 cases, 3,216 assertions**, all green |
| Early-reply matrix through the real game router/listener | **120 cases, 636 assertions**, all green |
| Total final mounted evidence | **456 cases, 3,852 assertions, 456 screenshots** |
| Full portal unit suite | **2,898 passed**, 93 skipped; 301 passing suites and 15 skipped suites |
| Built Jest/Reddit, including queued paid actions | **22 tests across 4 suites**, all green |
| Built Facebook smoke | **1 test**, green |
| Original scope probe | Final development and production green |
| Types, boundaries, locales, security, TSDoc and source sizes | Green; 26,570 documented declarations and 1,265 bounded source files |
| Builds | All six isolated target artifacts plus the Devvit server, built and audited |

Both mounted matrices run StrictMode in development and production, Chromium **153.0.8010.12** and native Firefox **153.0**, at **390×568**, **390×844** and **1280×844**. The 28 retry scenarios cover seven context changes across guesses, hints, continuations and skips. They verify one original action, preserved request IDs, no acquisition under another scope, originating-journal durability, and normal same-scope retries. The controlled clock establishes the lifecycle interleaving; it is not a latency measurement.

The ten early-reply scenarios cover acceptance before receipt, duplication after native input, wrong request/index/token/mode, UID/generation/locale replacement, and rejection rollback. They use the actual game message router and listener, await completed bridge parsing and visible commit, and verify draft preservation, authoritative balance and journal retirement. Both matrices check browser errors, unhandled rejections and external traffic. The built suite also exercises confirmation, rejection, reload, unavailable successor recovery and repeated replies in the actual hosted game.

The captured original hook fails **12 of 40** retry assertions and **8 of 53** corrected early-reply assertions. The first early-reply fixture sampled after two animation frames without awaiting lazy bridge parsing or the resulting commit. That caused premature observations in production Chromium and development Firefox; the failed Firefox development preflight stopped its planned production iteration. The corrected final runs await routing and semantic DOM state, and both browsers and modes pass. The preflight code and logs remain preserved. The first paid-preview diagnostic also tested an incorrect `h2` hypothesis; subsequent traces confirmed an absent card rather than a heading change. No production markup or maintained test assertions were changed to make those checks pass.

**Provenance and cleanup.** The final phase freezes **2,449 selected source/configuration/content/compiled inputs**. All earlier 2,448 inputs remain present; the only existing selected files changed are the recovery hook and portal package, and the only added selected file is the maintained regression. Before/after hashes and `owned.diff` isolate these changes from the shared dirty checkout. The existing queued-action browser test's hash is unchanged.

The initial scope-only phase and its failed expanded smoke suite are retained separately. Its source manifests agree, its **1,301 built files** and six inventories are preserved, and its temporary build tree and exact owned metadata were removed before the Skip correction. Only the production recovery hook changed between that phase and the final phase. All six artifacts were rebuilt after that correction. Final before-build, after-build, after-runtime and terminal source manifests agree; no selected source changed after the final freeze. Supplemental fixture repairs affected only artifact-owned harness files, whose final hashes are recorded.

The final **1,301 built files** and six inventories are preserved with SHA-256 hashes. Each phase also preserves the one additional inventory produced by its Facebook smoke harness. Inventory checks keep the recovery hook in the hosted Jest/Facebook/Reddit graphs and out of standalone YouTube/Netflix/Yahoo. They enforce Facebook-only advertising, no Firebase in Reddit or standalone graphs, and no hosted multiplayer/provider packages in standalone graphs. All 16 locales remain complete without new production copy.

The previous authority results are **reused, not freshly rerun**: 391 core tests, 1,730 backend tests, 677 actual-SDK integrations and 17 Node 22 SDK tests. All **824 selected authority/configuration/compiled inputs** remain unchanged, the reused log hashes match, and all **24 canonical/installed core-copy comparisons** still match. Client fixture coverage does not certify production authentication or all backend suites.

**YouTube used the permitted incomplete-content fixture command; this is not a release-content certification.** Netflix and Yahoo remain provider-neutral candidates. Nothing was committed, pushed, deployed or published. The earlier multiplayer retirement backend/callable/Devvit route and TTL changes still need deployment before updated clients are deployed.

All **30 tracked jobs** have actual terminal exit statuses, including expected red, diagnostic and preflight runs. Owned build bytes were copied and verified before removing the exact temporary trees and inventory files. Native harnesses closed their browsers and servers and removed their owned scratch roots. The initial evidence audit referenced a planned Firefox production preflight log that was never created after the failed development iteration; the job record was corrected to list the output actually produced. Final verification succeeds without adding a synthetic log or changing test observations.

Evidence is in `artifacts/pending-play-scope-retirement-2026-10-06/`. Run its frozen-state audit from the repository root:

```sh
python3 artifacts/pending-play-scope-retirement-2026-10-06/verify.py
```

The audit checks current source hashes, owned changes and reverse application, terminal jobs, fresh final results, both red/green matrices, original probes, the unchanged maintained test, authority reuse, compiled copies, both preserved build sets, inventories and cleanup. Later goal edits require their own evidence; this verifier certifies only this frozen state.
