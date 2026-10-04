# Cold draft ownership and idle delivery — 3 October 2026

Verified progress on the active reliability, performance, playability and latency goal. Reload recovery now retires superseded draft-only sessions, preserves valid input and required deliveries, and avoids an idle delivery interval. A retained Daily draft also releases in-memory ownership when the host falls back to Classic, so Classic remains playable. The broader goal remains active.

## Reproductions

The mounted reload fixture reproduced obsolete-session resurrection in under one second: the host issued session **99**, but the client restored **CL from session 2** and kept the obsolete journal. Its balance was already correct at 325. Cleanup applied only after a journal became active in memory; the initial storage read could still load its old question. Moving the decision into shared reconciliation fixes both paths. The original-policy-and-hook substitution remains red in the finalized verifier.

An instrumented idle draft measured **one five-second interval instead of zero**. Startup restoration scheduled delivery renewal even without a guess or paid action. Both startup scheduling branches now require a pending delivery. The fixture observes active timer IDs while preserving the original browser scheduling functions and callback arguments.

Preserving other-mode input exposed a related ownership failure through the actual host fallback: after an external fake-authority Daily completion, the host displayed Classic, but its native QQQQQ submission produced **zero outgoing requests instead of one** and a temporary-unavailable notice. The old Daily draft still owned the in-memory journal. Recovery now detaches an idle other-mode draft without deleting its durable input; a subsequent explicit Classic submission can own the journal normally. Required guesses, paid actions and buffered successors remain protected. An earlier fixture attempt requested a different mode directly; the host correctly kept commands pinned to its current mode. The final test uses the real completed-Daily fallback.

## Final behavior

- A draft-only root is retired only when a non-winning host question in the same mode has a different session or riddle identity. It contains no queued guesses, paid action or successor. Matching input, required deliveries, other-mode input and a later draft behind completed victory remain recoverable.
- This policy runs before restoring input or sending requests for both persisted and in-memory journals. Cleanup releases ownership and cancels delivery/retry timers; an old question cannot replace a freshly issued same-mode session.
- Other-mode draft-only records stay durable while their in-memory ownership is released. No letters transfer into the displayed mode, and its next user submission is not blocked by an old draft. Starting a new submission uses the existing single-journal ownership contract.
- Cold restores with no pending mutation schedule no delivery interval. Queued guesses and paid actions still retain their exact identities and one active delivery interval in the fixture.

No visible copy, locale key, provider SDK, reward rule or retry timeout was added. The measured performance change removes a redundant idle interval; no CPU, battery or production-network latency improvement is claimed.

## Verification

Run `pnpm_config_verify_deps_before_run=false pnpm --filter @qwordly/portal test:cold-draft-recovery:browser`. A quick case uses `COLD_DRAFT_QUICK=1`, optionally with `COLD_DRAFT_VARIANT=classicSame` for idle timers or `completedDailyFallback` for mode ownership. `COLD_DRAFT_BASELINE_DIR` selects the captured original policy and hook.

The [verification summary](../../artifacts/cold-draft-recovery-2026-10-03/verification-summary.json) records final fingerprints and cleanup.

- **2,666 portal unit checks in 294 suites**, with 121 skipped. Eight new immutable-ownership regressions protect matching, superseded, other-mode, queued, paid, successor and preceding-victory boundaries. The current shared tree also includes sixteen concurrently added utility-modal regressions.
- **2,580 injected browser assertions:** 366 cold-draft assertions in each React mode; 420 prior rollback assertions in each mode; 111 prior accepted buffered-recovery assertions in each mode; 690 terminal-journal assertions; and 96 guest terminal-checkpoint assertions.
- The new matrix runs ten scenarios at 390×568, 390×844 and 1280×844 in development and production. It covers Classic/Daily replacements, changed riddle identity, matching drafts and real reloads, other-mode input, required guesses/hints, buffered successors, active interval counts, native typing, fresh-session submissions, completed-Daily fallback and browser errors.
- **22 final built journeys in four suites** cover Reddit guest/authenticated play, hosted play, profile guidance and queued economy recovery.
- Native Firefox MCP at 390×568 confirms an empty board and null obsolete journal under session 99, zero idle delivery intervals, native OQQQQ submission to session 99, a single confirmed wrong row and balance 325. A second native journey restores Daily E, continues it to EA, observes the host's actual completed-Daily fallback, keeps EA durable while Classic is empty, and submits QQQQQ once in Classic. Its journal then clears and the acknowledged external-completion balance remains 400. Raw observations are parsed and checked in [the current Firefox record](../../artifacts/cold-draft-recovery-2026-10-03/firefox-current-verified.json).
- All six isolated artifacts build and pass their audits. Jest remains **0.53 MB initial resources against its unchanged 0.55 MB budget**. Types, TSDoc (25,031 declarations), whitespace and syntax checks pass. Five owned source fingerprints and 759 source, target and configuration fingerprints remain unchanged after validation, with no added or removed build inputs.

The mounted fixture uses the actual game, host, bridge and fake-authority answer/completion methods. Required guess/hint replies are held, and the paid scenario explicitly enables the host economy capability. These are injected-provider checks, not live remote-provider or production-network measurements. The completed-Daily transition includes a real fake-authority completion before requesting the current mode again.

A concurrent reducer change preserving player-owned utility pages during question loads landed at the first final fingerprint check. It was preserved; all six builds, unit/type/documentation checks, injected matrices, built journeys and native Firefox journeys were rerun against the updated shared tree.

All owned validation processes are terminal. Both owned Firefox fixture servers were stopped, their scratch directories removed and all owned tabs closed, preserving the original about:blank tab. No commit, push or deployment was performed.

Next investigation: host-confirmed terminal losses after the paid sixth attempt, including reload, completion acknowledgement and journal retirement.
