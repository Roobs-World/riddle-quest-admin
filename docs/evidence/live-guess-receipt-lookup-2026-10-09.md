# Authenticated read-only live guess proof — 9 October 2026

The backend now exports `confirmLiveGuessReceipt`. Its bounded core query identifies ticket, original request, riddle, position and the attempt count before acceptance. Authentication selects the account; the browser cannot supply an account, guess, action or economy field. The response contains only `accepted` or `unconfirmed`. Existing join/update request and response contracts remain unchanged.

The service reads owner profile, deletion guard, rollout, owned ticket, actual match and the user-scoped immutable receipt in a Firestore read-only transaction. It checks logical expiry and account/run/seat bindings. Only the exact private proof created by the original accepted wrong guess can confirm the locator. Legacy receipts, conflicting locators, wrong accounts, expired/corrupt authority and noneligible commands remain unconfirmed. Deleted accounts and disabled access are rejected.

The callable explicitly skips the mutation operation lease because it is a pure observer; deletion is still checked in its transaction snapshot. Lookup cannot score, renew a seat, advance bots, settle coins or backfill receipts. The SDK cases snapshot every existing emulator document recursively, including private nested receipts, recording data and nanosecond update time before and after lookup. The second player's receipt is resolved through its ticket's actual creator-owned match.

## Verification

- Pinned Node 22 compilation and backend lint pass. TSDoc and file-size audits pass.
- 73 real Firestore SDK cases across three suites: 43 existing live-race cases, four proof-creation cases, and 26 lookup cases. This is a targeted integration run, not the entire backend SDK matrix.
- All 1,769 backend unit cases in 141 suites pass, including callable authentication, strict request/response parsing and absence of mutation-lease admission.
- All 391 core cases and 3,090 client cases pass. Client browser suites remain excluded from this unit run.
- Six isolated target builds and the Devvit server build pass. The 1,299 built files, six dependency inventories and both isolated compiler outputs are archived and hashed.
- Final before/terminal/verified manifests match for 2,520 selected source inputs. These do not inventory every content/public file. An initial cohort was followed by stronger lookup tests and two missing declaration comments; the recorded cohort delta contains only the lookup test file. Final compilation, SDK/backend/core/client tests and target builds were rerun after this change.
- The first restricted client run failed to bind localhost in Reddit gateway tests. The loopback-authorized rerun and final full client run both pass; the failed log is retained.
- Owned temporary roots were removed after all jobs terminated. All six final emulator sockets were confirmed closed from the host namespace.

No UI changed and no new rendered-browser evidence is claimed. Adapter wiring, Reddit gateway operation, bounded client lookup and cancellation-safe local draft recovery remain pending under [ADR 0006](../adr/0006-live-guess-receipt-recovery.md). The delayed-reply typing gap is not fixed by this backend stage alone. Nothing was deployed.

Evidence: `artifacts/live-guess-receipt-lookup-2026-10-09/`; verify with `python3 artifacts/live-guess-receipt-lookup-2026-10-09/verify.py`.
