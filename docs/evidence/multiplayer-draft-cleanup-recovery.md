# Multiplayer terminal draft cleanup recovery

Verified 2026-10-01 against local production source. The hosted Jest E2E chat is actively running and its preview/evidence remain untouched.

## Failure and change

A silently rejected deletion was recorded as successful removal. Thrown deletion failures also lost their next cleanup opportunity when authoritative abandonment returned the player to the hub and released the run snapshot. Initial unit regressions failed twice against the original source, with 49 retained/additional cases passing. A production browser harness using the exact prior session and draft module also retained PI after deletion access recovered.

Terminal authority now creates a minimal pending cleanup receipt containing the exact previously observed bytes, captured session lifetime and monotonic retry deadline. The draft module verifies the current storage value twice before removing it, confirms successful deletion by reading back an empty key and retries at most once per second while the same session remains active. This also recovers when reads are temporarily denied at terminal confirmation. Session ticks continue cleanup after the terminal run has returned to the hub. No scoring or authority snapshot is retained for cleanup.

Account replacement, disposal, new run binding and invalidated journey lifetime revoke pending cleanup. A newer tab's changed value is preserved. Disposal cancels retries rather than leaving a background storage mutation after the game closes. Canonical run validation and logical draft expiry continue protecting any record that cannot be physically deleted.

## Verification

- Complete client suite: 1,592 tests across 179 runnable suites passed; 95 tests in 13 opt-in suites skipped.
- Focused draft suite: 52 cases pass. Six added cases cover thrown/silent deletion and denied reads, bounded retry attempts, newer-tab replacement, account replacement and disposal.
- Six injected production cleanup browser scenarios passed: thrown deletion, silent deletion and denied reads at 1280px and 390px. Each types PI, accepts an actual fake-authority abandoned run through server resume, loads the live six-category hub, restores storage access, confirms the draft and active-run pointer are removed and issues no gameplay mutation. No alerts or page errors occurred.
- Sixteen retained ordinary/denied-read/scheduled/write-recovery browser scenarios passed.
- All seven isolated configured target builds and exact dependency-evidence verification passed.
- Portal types, TSDoc, source size, security and scalability checks passed.

The browser baseline session was checked byte-for-byte against the previous batch's recorded source hash before substitution. Logs, screenshots, prior modules and source/artifact hashes are in `artifacts/race-draft-cleanup-recovery/`. Browser viewport simulations are not physical device evidence. This client-only change requires no Firebase Functions deployment.

## Completion receipt

The focused proof is `artifacts/race-draft-cleanup-recovery/verification-held.json`, not an accepted full-source dashboard receipt. The 38-check manifest `docs/development-tasks/race-draft-cleanup-recovery.json` adds the cleanup browser check and retains every previous backend/client recovery gate. The source-stability guard remains unchanged. Run guarded completion after the other E2E chat finishes changing source evidence. No Jest upload, activation or publication was performed in this batch.
