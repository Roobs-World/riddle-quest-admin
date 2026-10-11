# Current game render ownership

The existing injected Chromium harness passed 669 assertions per React mode (1,338 total) against the current source. It exercised hosted single-player, live-race multiplayer and the self-contained YouTube fixture at 390×568, 390×844 and 1280×844. Scenarios include repeated typing/backspace, parent updates, virtual-key input, remounting and authoritative feedback (where applicable).

Every tested draft retained ordered input, fixed keyboard DOM identity and explicit one-time submission. Mounted identities were not repeatedly initialized. Instrumented live-race clock initialization and confirmed-guess reduction remained zero during the measured updates. Confirmed feedback and later question transitions remained correct. This probe measures those instrumented operations, not total React renders or real network latency.

No production changes were warranted. The live elapsed clock already isolates its updates; the single-player session tick also owns expiry/recovery, so removing it solely because it runs every 50 ms would require stronger behavioral evidence. All 2,487 selected source inputs match the preceding backend assessment. Existing six-target build evidence remains applicable to the unchanged client. Nothing was deployed. Both process handles exited zero and harness finalizers close browsers/servers and remove their own scratch directories.

Evidence: `artifacts/race-render-current-2026-10-08/`, including per-mode observations, screenshots, terminal logs, source hashes and verification results. The overall improvement goal remains active.
