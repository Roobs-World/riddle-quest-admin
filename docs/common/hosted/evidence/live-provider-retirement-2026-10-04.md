# Live race provider retirement — 4 October 2026

Replacing or removing the authenticated live race capability now retires the selected seat and returns to the existing intro. A fresh explicit start receives its own join key and seat. A receipt arriving during the retirement commit cannot update the retired journey or notify completion. Stable capability updates retain the current race, draft, focus, scheduler and subscription.

## Reproduction and controls

The production Jest surface can recreate its live capability when registration state changes. `RaceTo10Game` previously retained its selected race while passing the new capability into the existing `LiveRaceGame`. A focused actual-entry browser loop exposed an old ticket being polled through the replacement adapter. The old seat was not retired. Removing all answer edits preserved the failure.

```sh
pnpm_config_verify_deps_before_run=false LIVE_PROVIDER_QUICK=1 \
  LIVE_PROVIDER_SCENARIOS=idle-minimal \
  LIVE_PROVIDER_REPORT_DIR=artifacts/live-provider-retirement-2026-10-04/red-minimal \
  node packages/portal/scripts/verify-live-provider-retirement-browser.mjs
```

Both the initial and minimized original loops failed five retirement assertions. The minimized loop requires only an accepted join and a capability replacement. The adapter validates ownership and rejects another provider's ticket; the application still attempted that invalid poll.

Three hypotheses were recorded before the controls: selection survived capability replacement, ordinary parent updates caused the issue, or retirement had a commit-time receipt gap. Thirty-two profile updates with the same live capability passed. Resetting selection alone fixed the minimized provider failure. An independently held terminal receipt released in a parent layout effect during owner replacement still invoked the retired result callback and emitted its completion event. The same fault appeared during capability removal. The existing owner key therefore did not close this timing gap: passive cleanup had not yet disabled receipt admission.

## Change

`LiveRaceEntry` records its current live capability in state. When that identity changes, it clears selection during rendering before the replacement children can commit. This covers both ordinary public seats and immutable transports selected by a native audience chooser. An uncommitted speculative capability change does not retire the committed race.

`LiveRaceGame` marks its delivery lifetime inactive in layout cleanup. Network delivery, timers, subscriptions, retry backoff and best-effort idempotent leave handling retain their existing passive effects. Late receipts continue to clean up their original provider's seat with its original leave key. Development StrictMode replay reactivates the same lifetime synchronously.

The owned production diff is five lines in `LiveRaceGame.tsx` and seven in `RaceTo10Game.tsx`. The new browser verifier is registered in the existing game verification chain. Visible copy and provider SDK boundaries are unchanged.

## Before/after evidence

The captured original and updated components were built with the same final production fixture. Identical scenario/viewport/assertion keys were compared.

| Controlled condition | Original | Updated |
| --- | --- | --- |
| Idle provider replacement | Old seat stays selected | Existing intro offers a fresh start |
| Poll sent to replacement adapter with the old ticket | One invalid poll | Zero |
| Native audience selection after its base capability changes | Old selected transport remains mounted | Old seat retired through its selected transport |
| Old join receipt held across a fresh replacement start | Replacement cannot independently start | New seat plays before the old receipt is released |
| Terminal receipt released during owner/provider retirement commit | Retired callback and completion event delivered | Neither delivered |
| Thirty-two updates with the same live capability | Draft/focus retained, no delivery churn | Same behavior retained |
| Suspended provider replacement that never commits | Current receipt completes through committed provider | Same behavior retained |

The original final survey retains 273 deliberately failing defect assertions out of 603. All other assertions pass. Each updated survey passes all 603 assertions. When the original retains its old seat, the verifier records the missing replacement-start behavior instead of pretending to drive a new seat. Retirement attempt keys, original adapter ownership, independent join keys, subscription tickets, clean drafts and subsequent native submission are checked explicitly.

## Verification

| Check | Result |
| --- | --- |
| New injected browser journeys | 72 journeys / 1,206 assertions |
| React modes | Development StrictMode and production |
| Viewports | 390×568, 390×844, 1280×844 |
| Covered cases | Public and native audience selection; pending join/poll/guess/result/leave; receipt during provider/owner/removal commit; stable updates; suspended uncommitted replacement |
| Callback lifetime regressions | 1,116 assertions |
| Reconnect/input regressions | 708 assertions |
| Immediate native submission regressions | 306 assertions |
| Race action focus regressions | 684 assertions |
| Hidden clock regressions | 396 assertions |
| Total injected browser assertions | 4,416 |
| Portal unit suite | 2,724 passed in 296 suites; 121 optional browser tests skipped |
| Current built game journeys | 37 passed in seven suites |
| Types and documentation | Passed; 25,170 declarations documented across 1,138 files |
| Six target builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix candidate and Yahoo candidate passed |
| Source stability | Independently recollected 765-path source/build-input inventories and hashes match |

Native Firefox verification at 390×568 entered an old draft, replaced the capability, started a fresh seat and submitted `piano` once to reach 1/10 through the replacement adapter. A separate delayed-join journey started and typed in the new seat while the old join was still held. Releasing that old receipt preserved the same native editor, focus and `pian` draft; typing `o` and Enter advanced the new seat once. A native Enter journey released a held terminal result during the provider replacement layout commit and confirmed zero retired completion callbacks/events, zero cross-provider requests and one original-provider retirement key. Eleven raw observations were parsed and asserted, including a separately verified settled replacement after its first asynchronous observation. No browser error or unhandled promise was recorded.

The three owned Firefox tabs were closed, the original blank tab preserved, the fixture stopped and its scratch directory removed. Artifacts, captured originals, minimized failures, staged controls, screenshots, source diff, asserted production comparison and raw/asserted Firefox results are in `artifacts/live-provider-retirement-2026-10-04`.

The adapters and commit faults are controlled local fixtures. Result callbacks are client notification evidence, not proof of a live economy grant. No production provider round-trip latency or mobile software-keyboard claim is made. The broader reliability, performance, playability and latency goal remains active.
