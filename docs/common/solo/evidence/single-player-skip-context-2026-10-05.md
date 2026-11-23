# Classic skip preparation from committed session context — 5 October 2026

Classic skip now gets the locale and content-preparation index from the transaction that commits or replays the skip. The callable no longer fetches the same private session beforehand just to obtain its locale. The account and session reads remain parallel inside the transaction.

On a new skip, content preparation receives the advanced index and the locale observed by the committed transaction attempt. On replay, it receives the current canonical account index alongside the unchanged cached skip response. An earlier skip receipt therefore cannot make the preparation task use an older entitlement after the player has already advanced. There is no additional profile read, cached account snapshot or client-supplied supply context.

The internal `classicSupply` context is never persisted in `skipResult` or included in the public callable response. Session expiry, mode, riddle and issued-field validation run within the same transaction before spending or replay. The existing standalone session reader reuses the same validator. The charge, progress mutation, skip counter and receipt remain atomic and idempotent.

## Matching reproduction

The real callable handler and real skip transaction run over a deterministic persistence seam. Each document read costs 200 ms and the awaited supply task costs 400 ms:

| Fixture measurement | Before | After |
| --- | ---: | ---: |
| Elapsed handler time | 800 ms | 600 ms |
| Document reads | 3 | 2 |
| Standalone session reads | 1 | 0 |

The baseline includes a standalone session read, then parallel transaction session/account reads, then supply preparation. The fixed path has one parallel transaction read stage, then supply preparation. Request and response validation, economy logic, issued-session validation and write shaping stay real. HTTP transport, account-operation leases and commit timing are outside this fixture. These numbers establish an eliminated read stage; they do not measure production latency.

The target timing assertion fails on the old code. A 34-case focused reproduction fails eight assertions on the old implementation. The intermediate change removes the extra fetch and passes the timing and validation probes, while one replay-context assertion still fails; deriving replay preparation from current transaction-owned account progress resolves that remaining case.

Ten real Admin SDK/Firestore emulator cases independently exercise:

- Four concurrent callables with the real account-operation lease, charging and advancing exactly once while making zero direct session reads.
- Replaying an earlier receipt after current progress advances to index seven, preserving the exact public response and account while preparing current content.
- Actual SDK rollback/retry after an injected retryable abort, using the second attempt's account balance and session locale. This is an injected abort, not a measurement of natural contention.
- Malformed locale, content key, completion key or answer, rejecting before a charge or supply task.
- Replay after account removal, rejecting without recreating the account.
- Existing wrong-riddle and expired-session rejection.

The matching old implementation fails three cases while seven authorization/economy controls pass. All ten pass after the fix. The observer forwards original document SDK methods; it never fabricates transaction snapshots or substitutes database writes. The derived supply task is stubbed in these emulator tests so its committed inputs can be asserted independently of generation availability.

## Verification

- **1,637 backend unit tests / 132 suites passed**.
- **261 real Firestore/Realtime Database emulator tests / 16 suites passed**, including ten new skip probes and the existing multiplayer, completion, deletion and referral controls.
- **69 focused tests / five suites passed**.
- Backend TypeScript, targeted lint and TSDoc passed: **25,739 declarations / 1,152 files**.
- All six isolated target builds and artifact audits passed. **YouTube used the incomplete-content fixture; this is not release certification**.
- **Eight built-client browser tests / three suites passed**, retaining the 100 ms buffered single-player transition threshold. The first browser process exited 143 without test output; its confirmed terminal attempt was preserved and the unchanged check passed on rerun. The cause of that interruption was not established.
- **2,350 freshly enumerated source inputs** stayed unchanged through final gates, including compiled and installed shared core code.
- **1,300 built files** and six dependency inventories were preserved with SHA-256 hashes. Owned temporary outputs and matching metadata were removed after verification. All 14 tracked jobs are terminal and owned emulators stopped.

The initial TSDoc probe identified missing comments in newly added test declarations; those were repaired before the source freeze and final gates. The timing fixture's initial expiry setup also required correction to retain its SDK-like conversion method. These setup attempts are retained separately from the passing baseline and matching red/fixed probes.

Evidence is in `artifacts/single-player-skip-context-2026-10-05/`. `report-generation.py` checks red/fixed counts, timing traces, the full regression gates, source hashes, build hashes, matching inventory cleanup and reverse applicability of the owned patch before generating `verification-summary.json`. No deployment was made. The broader improvement goal remains active.
