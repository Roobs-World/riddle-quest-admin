# Live race callback lifetime — 4 October 2026

Ordinary parent updates now preserve the live race delivery scheduler, subscription and chosen focus. Pending completion and leave receipts call the latest committed callback. The change is confined to `LiveRaceGame.tsx`; the browser regression is registered in the existing game verification chain.

## Reproduction and diagnosis

The actual `RaceTo10Game` entry supplies a new inline close callback on each parent render. `GameFrameApp` also supplies an inline live result callback. Previously those callbacks changed `apply`/`deliver`, restarting the delivery effect. That effect immediately delivered a poll, replaced the signal subscription and focused the outer dialog. The native editor itself remained mounted.

The focused command was run twice against the original source:

```sh
pnpm_config_verify_deps_before_run=false LIVE_CALLBACK_QUICK=1 \
  LIVE_CALLBACK_REPORT_DIR=artifacts/live-callback-lifetime-2026-10-04/red-entry \
  node packages/portal/scripts/verify-live-callback-lifetime-browser.mjs
```

Both runs failed the same four assertions: one extra poll, one new subscription, one retired subscription and lost native focus after one parent update. There was no extra join or draft loss. Removing callback identity changes made the loop pass. Changing only the close callback or only the completion callback reproduced all four failures. An independent held poll with stable callbacks passed, ruling out ordinary observation as the cause. DOM identity remained stable, ruling out editor remounting. These controls test the three ranked hypotheses recorded in the chat.

The fix stores the callbacks in stable refs and refreshes them in a layout effect after commit. Transport, owner and selection dependencies remain in place. Receipt handling reads the refs; callback identity no longer changes delivery ownership. A suspended concurrent render is covered to ensure an uncommitted callback cannot handle the result. Removing the optional completion callback while a receipt is pending is covered too.

## Production comparison

The captured original component and updated component were built into identical injected production fixtures. Every snapshot is validated with the real schema; scoring and command acceptance belong to the controlled adapter. Tests drive the real race entry, native editor and receipt code.

| Controlled action | Original | Updated |
| --- | --- | --- |
| Extra polls for 32 ordinary parent commits | 32 | 0 |
| Subscription replacements for those commits | 32 | 0 |
| Native typing focus after those commits | Lost | Retained |
| Callback epoch for a delayed terminal result after epoch 1 committed | 0 | 1 |
| Callback epoch for a delayed leave after epoch 1 committed | 0 | 1 |
| Completion callback removed before its held receipt arrived | Old callback invoked | No callback invoked |

The original survey retains 117 deliberately failing defect assertions out of 558; all remaining assertions pass. The updated development and production surveys each pass all 558 assertions. The comparison checks identical scenario/viewport keys and permits only the identified defect categories to differ.

## Verification

| Check | Result |
| --- | --- |
| New injected browser journeys | 90 journeys / 1,116 assertions, development StrictMode and production |
| Viewports | 390×568, 390×844, 1280×844 |
| Covered lifetimes | Actual entry updates, 32-update bursts, intentional Tab focus, stable callbacks, independently changing callbacks, held polls/guesses/results/leaves, removed callback, suspended render, unmount and account replacement |
| Reconnect/input regressions | 708 assertions |
| Immediate native submission regressions | 306 assertions |
| Race action focus regressions | 684 assertions |
| Hidden clock regressions | 396 assertions |
| Fixed keyboard preparation regressions | 708 assertions |
| Keyboard listener lifetime regressions | 376 assertions |
| Total injected browser assertions | 4,294 |
| Portal unit suite | 2,724 passed in 296 suites; 121 optional browser tests skipped |
| Current built game journeys | 37 passed in seven suites |
| Types and documentation | Passed; 25,169 declarations documented across 1,138 files |
| Six target builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix candidate, Yahoo candidate passed |
| Source stability | Independently recollected 765-path source/build-input inventories and hashes match |

Native Firefox checks at 390×568 entered `pian`, committed 32 parent updates, retained the same focused editor with no extra polls or subscription churn, typed `o` without refocusing, and submitted `piano` once to advance to 1/10. Separate native Enter and Escape journeys held authoritative receipts across a parent commit and invoked the latest completion/close callback once. Completion emitted one owned event; both terminal and cancelled views released their subscription after React committed. All eleven recorded steps were parsed and asserted. The temporary fixture was stopped, its scratch directory removed and the three owned tabs closed; the original blank tab was preserved.

Artifacts, captured originals, failed loops, isolated controls, screenshots, the source diff, raw and asserted Firefox observations, the asserted production comparison and the verification summary are in `artifacts/live-callback-lifetime-2026-10-04`.

These counts measure unnecessary requests and listener changes in the controlled adapter. They do not measure live provider round-trip latency or mobile software-keyboard behavior. The broader reliability, performance, playability and latency goal remains active.
