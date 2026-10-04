# Live delivery wait retirement — 4 October 2026

Retired live races now release their local join/update delivery deadlines promptly. Their original adapter promises remain observed: late successful receipts can still retire the original seat with its original idempotent leave key, and late failures cannot revive the retired view. Cancelling the local wait does not cancel a server mutation.

The original actual-entry browser reproduction held a join, replaced its provider and found one 10-second deadline still pending after the old race was removed. A production control reproduced this for a join, guess and 2-second poll. Thirty-two updates with a stable adapter passed. This ruled out both the polling scheduler and development StrictMode replay as the cause. An overlapping held poll and player command retained two deadlines. The original final survey deliberately fails eighteen resource assertions across three viewports; its remaining behavior assertions pass.

`LiveRaceGame` now creates one lazy cancellation controller for the mounted journey and passes its signal to the existing delivery-deadline helper. The existing retirement microtask aborts that controller after confirming a real unmount, including confirmed closure. StrictMode effect replay and ordinary callback updates preserve the active wait. Sharing the controller also releases superseded polls alongside the current player command. The existing helper already supports local cancellation while retaining late-receipt handlers.

The new verifier transparently instruments native timeout allocation and clearing. It tracks only 2-second and 10-second deadlines with the real delivery helper in their stack. It neither shortens deadlines nor changes adapter settlement. Held deliveries must own the expected timer before retirement, making a broken instrumentation probe fail rather than report a false zero. Updated production and development journeys remove all measured retirement deadlines, preserve late cleanup and then submit a native answer through the replacement seat.

| Verification | Result |
| --- | --- |
| New injected browser journeys | 66 journeys / 1,260 assertions; development StrictMode and production |
| Viewports | 390×568, 390×844, 1280×844 |
| Covered deliveries | Join, poll, overlapping poll/guess, guess, terminal result, leave and commit-time retirement |
| Active controls | Stable updates and uncommitted speculative provider replacement |
| Provider retirement regressions | 1,206 assertions |
| Callback lifetime regressions | 1,116 assertions |
| Reconnect/input regressions | 708 assertions |
| Total injected browser assertions | 4,290 |
| Portal units | 2,724 passed in 296 suites |
| Current built game journeys | 37 passed in seven suites |
| Types and documentation | Passed |
| Six isolated builds and audits | Jest, Facebook, Reddit, YouTube fixture, Netflix candidate, Yahoo candidate passed |
| Source stability | Recollected 765-path source/build-input inventories match before/after verification |

Native Firefox at 390×568 observed a held join's deadline change from `[10000]` to `[]` on retirement while its adapter receipt stayed held. A fresh seat started independently. Releasing the old receipt retired the original provider once, retained the new native editor's focus and `pian` draft, and emitted no completion callback/event. Native `o` and Enter then advanced the replacement race once to 1/10. All three raw observations were parsed and asserted. The owned tab was closed, original blank tab preserved, fixture stopped and scratch directory removed.

The verifier is registered in the game browser verification chain. Captured originals, failed reproduction, production controls, final matrices, screenshots, source diff, Firefox proof and asserted verification summary are in `artifacts/live-wait-retirement-2026-10-04`.

This pass measures local join/update wait resources. Invitation-confirmation preview reads are a separate follow-up. No live provider latency or server cancellation claim is made. The broader reliability, performance, playability and latency goal remains active.
