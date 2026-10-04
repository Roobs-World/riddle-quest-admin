# Buffered rejection and draft recovery — 3 October 2026

Verified progress on the active reliability, performance, playability and latency goal. Rejected buffered answers now retire their dependent deliveries while preserving the player's same-question draft and the current acknowledged host profile. Fresh host history and purchased hint locks survive recovery. The broader goal remains active.

## Reproductions

The mounted game first restored the journal's older profile after successor rejection: **300 coins instead of the acknowledged 325**. Once profile preservation was fixed, the held reconciliation journey exposed **empty input instead of CL**, first during rollback and then after a fresh reply with the same session token. A replacement-session check found an obsolete draft journal still attached to the previous session. Another fresh reply containing a newer accepted QQQQQ row and an authoritative O hint erased that row and the restored CLO draft.

The actual built queued-economy journeys exposed two further failures. An unpaid hint preview could be retained as input. When rollback reused the same riddle object, the recovery effect did not run again; the old CRANE submission replaced the player's newer CL draft. The captured diagnosis shows the pre-rejection board containing CRANE followed by PL, where P was the provisional hint replacing the player's C. The strengthened hint and Skip journeys now assert the original CL draft, slot, session ownership, absence of paid deliveries and locks, and continued native typing.

Failing logs, original source snapshots and final observations are retained in [the pass artifact directory](../../artifacts/buffered-rollback-recovery-2026-10-03). Run `pnpm_config_verify_deps_before_run=false pnpm --filter @qwordly/portal test:buffered-rollback-recovery:browser` for the new matrix. Its verifier supports a quick reproduction using `BUFFERED_TERMINAL_REJECTION_ONLY=1 BUFFERED_TERMINAL_QUICK=1`, with replacement or newer-history variants selected by `BUFFERED_TERMINAL_REPLACEMENT_ONLY=1` or `BUFFERED_TERMINAL_CANONICAL_ONLY=1`.

## Final behavior

- Rollback preserves the current host profile. An old journal cannot downgrade acknowledged balance/progression or supply a profile when the host has none.
- A definitive rejection removes queued guesses, dependent issued questions and pending paid actions. It keeps only valid, nonempty, bounded draft cells for the exact rejected question. Current input from a different question cannot replace that draft. Legacy cursor handling and Unicode graphemes remain supported.
- Unpaid hint previews are removed before the player's draft is captured. The retained draft is restored immediately, including when rollback reuses the same riddle object. Failed storage writes clear obsolete rejected deliveries while retaining usable input in memory.
- A refreshed riddle object triggers restoration even with the same session identity. For draft-only recovery, complete newer host history takes precedence over the old gameplay base. Current host hint letters override old draft cells, remain locked and move the cursor to an editable slot.
- When reconciliation supersedes the active draft's session, its obsolete journal and ownership timers are retired. New submissions belong to the replacement session. Rejected guesses are not automatically replayed, and completed predecessors remain unreplayed.
- A completed predecessor's victory remains visible until native chest/fanfare dismissal, including when rejection and reconciliation finish before dismissal.

No visible copy, locale key, provider SDK, authority rule or retry timeout was added. These fixes remove demonstrated delivery and lost-input failures; no production network-latency improvement is claimed.

## Verification

The [machine-readable summary](../../artifacts/buffered-rollback-recovery-2026-10-03/verification-summary.json) records final source fingerprints and cleanup status.

- **2,642 portal unit checks in 294 suites**, with 121 skipped. Fifteen new regressions cover valid/invalid draft retention, exact ownership, dependent mutation removal, immutable storage round trips, Unicode and legacy cursors, current/null host profile preservation, and authoritative hint locks with valid or invalid-width drafts.
- **1,848 injected browser assertions:** 420 rejection assertions in each development and production React mode; 111 successful buffered-recovery assertions in each mode; 690 prior terminal-journal assertions; and 96 guest terminal-checkpoint assertions.
- The rejection matrix covers 390×568, 390×844 and 1280×844; rejection before and after native victory dismissal; and same-session, replacement-session and newer accepted-history/hint replies. It checks exact request identity, zero predecessor replays, once-only progression, unchanged acknowledged balance, durable draft/selection, rejection cleanup, replacement submissions, native typing and browser errors.
- **22 built journeys across four suites** cover Reddit guest/authenticated play, hosted play, profile guidance and queued coin actions. Two existing rejection journeys now exercise real typed drafts and remove provisional hint locks. Final UI assertions await the React board commit; an intermediate attempt read the durable draft before the rendered board committed and its log is retained.
- Native Firefox MCP at 390×568 verifies production rejection before dismissal, an empty delivery queue with CL retained, native chest collection and fanfare navigation, the newer QQQQQ row, CLO at slot 4, the locked host O hint and balance 325. Native C typing continues the draft to CLOC at slot 5 without changing the balance or resubmitting the rejected answer. Raw tool observations are retained and parsed into [the checked Firefox record](../../artifacts/buffered-rollback-recovery-2026-10-03/firefox-verified.json).
- All six isolated artifacts build and pass their audits. Jest remains at **0.53 MB initial resources against the unchanged 0.55 MB budget**. Types, TSDoc (25,020 declarations), source fingerprint comparison and whitespace checks pass.

The fixture uses actual mounted game, host and fake-authority services with an idempotent receipt wrapper. Rejected delivery fails before the fake authority accepts it; authoritative reconciliation is independently held. The newer-history variant submits its QQQQQ row through the actual fake authority and supplies trusted hint metadata; it does not simulate a new paid hint grant or charge. These are injected-provider checks, not live-provider measurements. One early before-dismissal fixture held reconciliation beyond the owned reply deadline; the final fixture releases a live reply before dismissal.

A concurrent Jest registration focus change landed during validation. Its implementation was preserved; this pass added the nine documentation comments required by the TSDoc audit and rebuilt all six artifacts against the current shared tree. Its separately run native keyboard/focus journey passes. Final fingerprints cover 758 source, target and configuration inputs, including that change. The unit skip count increased by one because its new native registration journey is separately gated as a browser test.

All owned validation processes are terminal. Both owned Firefox fixture servers were stopped, their scratch directories removed and their tabs closed, preserving the original about:blank tab. No commit, push or deployment was performed.

Next investigations: cold-start draft journals against superseded sessions, and recovery of terminal losses after the paid sixth attempt.
