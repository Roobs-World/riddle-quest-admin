# Final verification sequence

The final frozen source is `8491fe2641455299eb3b556e77c08deed360ca590e7854ebe872706dd240b89e` on focused local commit `5c26470ae8c8324af50424702b66aa9a0f6b7d37`. That commit contains only the privately proven seat-recovery fixture correction. The index is empty and unrelated dirty work is preserved. No push, merge or publication occurred.

Root's final 121-command supervisor is running under label `final-5c26470ae`, with status at `manifest-supervisors/final-5c26470ae/status.json` and evidence at `artifacts/development-checks/goal-20261024-standalone-final-5c26470ae/report.json`. Revalidate its recorded PID and start ticks on the host after any interruption before considering a restart.

The earlier source was `96e2b6b6f58b0e8a00d299435c643cc5a2fa034072e910213e9cf7a707a75402` on original HEAD `c1224fc18ff145d4d1d5ae34650ea075b378b6a5`. Its following evidence is preserved as historical verification, not silently relabelled for the final revision.

All 121 standalone browser commands and the 19 remaining browser command forms have passing evidence. The initial command 84 timeout remains an unresolved timing limitation, with its passing retry recorded separately. Multiplayer backend coverage command 13 passed 118 suites and 1,937 tests, and commands 31 and 70 passed. Command 180 and the immutable uploaded-artifact route sweep are finishing. The uploaded-artifact 79-case supervisor has exited successfully.

Command 154 failed because its idle second player was incorrectly expected to earn participation achievements and statistics. A private corrected probe passed at desktop and phone widths, with both players solving before catalog removal, both restored progress values checked, and all strict reward, badge, statistics and replay assertions retained. The diagnosis is in `final/seat-recovery-diagnostic/report.json`. No game runtime change is required.

The earlier source-bound jobs are terminal. The following sequence is now at step 3:

1. Apply only the privately proven change to `packages/portal/scripts/verify-live-race-seat-recovery-browser.mjs`. The file was clean against HEAD and the index was empty before this change.
2. Root reviews the diff and makes one focused local commit of that fixture only. Preserve every unrelated dirty file and staged change. Do not push or rewrite history. Freeze the resulting revision and full source digest before final commands.
3. Run all 182 exact manifest commands against that final revision/source. Preserve earlier reports and failed attempts. Root's 121 commands can use the bounded local launcher below; the coverage agent owns its other exact forms and the Riddle agent owns backend commands and target builds.
4. Validate the 192 manifests using their actual guards. Audit acceptance wording before promoting any local receipt; unresolved manual/provider/deployment acceptance must remain held. Append eligible new-revision receipts without deleting or rewriting old rows.
5. Perform a final canonical inactive Jest upload from the final snapshot, wait for provider READY readback, and verify CDN identity and startup. Any reuse of earlier immutable route/functional evidence must explicitly prove unchanged runtime inputs and the reporting-version-only byte delta. Do not call carried evidence a new exact-artifact run.

Bounded local standalone launcher, with a fresh label and no indices to run all 121:

```bash
node artifacts/goal-completion-2026-10-24/riddle/supervise-remaining-manifest-checks.mjs --launch --runner standalone FINAL_LABEL
```

The launcher writes its exact report path and owned process identity under `riddle/manifest-supervisors/FINAL_LABEL/status.json`, uses a distinct evidence directory, clears debug environment settings and has a 45-minute bound. It must never run production operations. Revalidate actual host PIDs and start ticks after any tool interruption; a missing observation handle alone is not a terminal result.

The 116 current-source production instances are already deployed and active. A verifier-only edit does not require another backend deployment. The separate dependency-only refresh of four legacy instances remains held for the explicit user approval requested after automatic review rejected it. No activation, publication or review submission is authorized.

Firebase CLI debug environment dumps were removed from five affected local logs, with original/new hashes and line counts retained in `backend/local-test-log-redactions.json`. Raw values were deleted. The active command 180 sink is private until sanitization and receipt-hash reconciliation finish. Never print raw emulator/deployment diagnostics or archived environment data.

Portfolio is independently testing a supported pinned Clerk UI fix. BeeHive's deployed feedback is verified except the unavailable licensed music file; actual client LMS acceptance remains external. Portfolio CI account gates, protected-health permission and the legacy-function approval are still pending user or external action.
