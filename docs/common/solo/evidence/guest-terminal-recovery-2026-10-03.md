# Terminal solo checkpoint recovery — 3 October 2026

Verified progress on the active game reliability, performance, playability and latency goal. This pass fixes losing an accepted Reddit guest win or a declined loss when the page closes after the terminal checkpoint is saved but before completion reaches the host. The broader goal remains active.

## Reproduction and cause

The fast regression drives the actual guest authority, shared reducer and `createSavedGame`, then creates the replacement authority from that checkpoint. Run `pnpm_config_verify_deps_before_run=false pnpm --filter @qwordly/portal exec jest --config jest.config.cjs --runInBand src/reddit/__tests__/RedditGuestHostServices.test.ts`.

The original service returned zero attempts for both a saved first-attempt win and fifth-attempt win: **2 failed, 18 passed**. Restoring the guest history alone exposed two additional failures: the reducer discarded the pending win, and the strict bridge rejected a fifth-attempt winning snapshot without Continue. A separate bridge regression reproduced that rejection: **1 failed, 12 passed**.

The browser harness uses native typing and Enter. Its capture listener interrupts only `game:completeGame`, leaving the real accepted guess and durable terminal checkpoint intact. Navigating to the same origin without that fault replaces the page. The original browser baseline reproduced the missing attempt count (**0 instead of 1**). Captured checkpoints, failed observations and staged unit logs are retained under the evidence directory.

## Final behavior and authority

- The guest authority restores eligible terminal intent and recomputes every feedback cell from the bundled answer. The winning answer must be last; unrelated identity, malformed shape, continued rounds, missing intent, inconsistent counts and forged green feedback fail closed.
- The bridge distinguishes a complete host-confirmed fifth-attempt win from five wrong guesses awaiting Continue. Accepted guesses after an earlier win remain invalid, and the ordinary five-attempt boundary and paid sixth-attempt limits remain enforced.
- The shared reducer restores a pending victory only when the loaded host supplies a complete winning feedback history matching the saved round, mode and attempt count. Saved colours and presentation evaluation alone cannot establish a win. The original completion intent is retried; rewards remain the host authority’s decision.
- A declined guest loss also resumes completion without reopening Continue. Existing guest completion receipts count the practice result once, with zero coins and XP, and then open a fresh example.

No visible copy or provider SDK was added. The existing translated victory and Next controls are reused. Canonical purchases, identity and global rewards retain their existing server authority.

## Verification

The [machine-readable summary](../../../../artifacts/guest-terminal-recovery-2026-10-03/verification-summary.json) includes final source SHA-256 fingerprints and these results:

- **2,937 unit/integration checks:** portal 2,588 in 294 suites, core 316 in 35 suites, and backend session/transaction 33 in 2 suites. Portal reports 118 intentionally skipped checks. The final focused regression has 75 passing checks.
- **264 injected browser assertions:** 96 terminal recovery assertions in each development and production React mode, plus 72 existing production guest round assertions. Terminal cases cover first/fifth-attempt wins and declined losses at 390×568, 390×844 and 1280×844, native Next, fresh boards, completion without guess replay, another reload without duplicate counting, zero economic rewards, same-origin gateway traffic and no browser errors.
- The existing shared recovery harness passes at 1280px and 390px: completion/startup reconnect, effect replay, synchronous acknowledgement, current profile preservation, hanging-load recovery, retired operation ownership, account isolation and native deletion/IME. Its local timings exclude production networking and do not establish a production latency improvement.
- **8 built journeys in 3 suites:** Reddit guest/authenticated play and Jest hosted/profile-tour journeys.
- Native Firefox MCP at 390×568 accepts four distinct wrong guesses and a fifth-attempt win while completion is blocked. Reload restores all five rows and victory, receives a successful completion without submitting another guess, records one practice win with zero rewards, and native Next opens example 2. A second reload keeps the count at one. Raw Firefox observations and independently checked `firefox-verified.json` are retained.
- All six final isolated artifacts build and pass their audits: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. Core/portal types and TSDoc (24,913 declarations) pass. No temporary diagnostic logging remains in the changed production sources.

Two intermediate browser fixture failures are retained separately: one expected uppercase DOM text although the recovered cells use CSS to display lowercase source letters as uppercase; another repeated the same wrong answer, which the existing duplicate-answer guard correctly refused. The final harness normalizes displayed letters and uses distinct native wrong answers. It retains the completion interruption and reload assertions.

Every owned validation process reached a terminal status. The owned Firefox tab and local harness server were closed; the original about:blank tab was preserved. No commit, push, deployment or publication was performed.

Next investigation: terminal recovery when the host has accepted a winning guess but a provider checkpoint is absent or predates that guess. That is a separate recovery window and is not claimed covered by this pass.
