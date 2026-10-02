# Multiplayer draft recovery immediately after countdown

The run stored privately for authority validation can remain `scheduled` after the countdown has activated its visible racing state. Draft persistence previously required that private snapshot to already say `active`. Consequently, typing on the first puzzle after a normal scheduled start did not save any draft until a server guess response arrived. Reloading in that interval resumed the run correctly but lost the input and selection.

Two public-session paths reproduced the loss: fresh preparation/readiness and cold resume of a scheduled countdown. A production component browser harness independently reproduced empty letters after reload on the exact prior session and draft modules. Both retained prior-module hashes match the preceding focused verification record.

The session now keeps the receipt time of its private confirmed run separately from observable state. Draft eligibility accepts an active canonical run, or a scheduled canonical run whose immutable server start has elapsed according to its private server-time sample and monotonic receipt anchor. The visible run must still be active and match its private run, locale and question. No server snapshot, score, penalty or command authority is changed. Local wall time still controls draft retention only.

## Verification

- `artifacts/race-scheduled-draft/unit-before.log`: both fresh-start and cold-resume reload cases lost first-puzzle letters and selection; the private-schedule safety case passed.
- `unit-after.log`: all 48 scheduled-start and retained draft cases pass. The five scheduled cases cover fresh start and cold resume with immediate or ten-second delayed responses, plus a mutated visible status, server clock, start time, receipt time and wall-clock skew that cannot authorize saving before the private schedule.
- `browser-before.log`: prior verified production session and draft module bytes failed the after-reload letter assertion. The original input was entered through the actual keyboard after the scheduled countdown.
- `browser-after.log`: twelve creator/challenger desktop/mobile scenarios cover canonical active reload, denied storage reads and scheduled countdown activation before the first guess. Input stays hidden until canonical resume, scheduled input and selection recover, unreadable bytes remain protected, run/start identity is preserved, and no mutation or presentation error occurs.
- `full-client.log`: all 177 runnable client suites pass with 1,567 passing tests; the existing 13 suites and 95 tests remain skipped.
- Types, TSDoc, file sizes, security, scalability and all seven isolated artifact builds/dependency verifications pass.

`docs/development-tasks/race-scheduled-draft.json` retains all 34 verification gates, including the full client suite and the expanded browser matrix. The full-source completion receipt and automatic dashboard recording remain pending while the authorized hosted pathway chat is active and editing evidence. This focused result does not weaken the stable-source guard.

The pinned active Jest preview remains unchanged and unpublished. This client-only fix requires no Firebase Functions deployment. The multiplayer reliability audit remains active.
