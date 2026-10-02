# Optional provider catch-up waits for canonical race completion

Optional provider adapters may become available while a race is reconciling its result. The adapter-entry effect previously inspected the displayed outcome, which can contain a clock-projected loss before the outcome response arrives. Installing the adapter in that interval sent a provider recording prematurely. A production game browser fixture reproduced one write while the canonical outcome request was still pending.

`RaceSession.getConfirmedOutcomeRunId` exposes only the privately server-confirmed result identity. Optional provider catch-up now uses that identity. Provisional result presentation still appears immediately, but it cannot authorize the catch-up write. The existing canonical outcome effect records completion once; synchronous canonical resume before provider entry remains recoverable. Account replacement, rematch and disposal clear the private completion identity. Changes to a retained public outcome cannot redirect it.

## Evidence

- `artifacts/race-provider-confirmed-outcome/browser-before.log`: production game sent one recording after the adapter was installed during provisional result reconciliation, when zero were expected. The retained prior Game source hash matches the earlier focused provider capability verification.
- `browser-after.log`: desktop/mobile cases install the adapter while a projected result and pending outcome are visible. No provider write occurs until canonical outcome confirmation, then exactly one write records the owned run. No race mutation or error alert occurs.
- `unit-after.log`: five public-session cases verify withholding a projected outcome, preserving confirmed identity despite public result edits, and clearing it on rematch/disposal/account replacement.
- `retained-record-recovery.log`: four desktop/mobile tournament/context cases retain synchronous confirmed result catch-up, rejected write recovery and rejection of reads started before successful recording, without repeating race mutation.
- `full-client.log`: all 179 runnable client suites pass with 1,583 passing tests. Existing 13 suites and 95 tests remain skipped.
- Types, TSDoc, maintainable file sizes, security, scalability and all seven isolated build/dependency verifications pass. No provider SDK, new visible text or translation is added.

`docs/development-tasks/race-provider-confirmed-outcome.json` retains the previous 35 gates plus the new browser gate. Stable full-source verification and automatic dashboard recording remain pending while the authorized hosted E2E chat edits evidence. Focused verification does not replace that receipt.

The pinned active Jest draft remains unchanged and unpublished. This client-only fix requires no additional Firebase Functions deployment. The previously verified backend replay/lease fixes remain deployed. The multiplayer reliability audit remains active.
