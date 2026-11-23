# Host-confirmed terminal recovery — 3 October 2026

Verified progress on the active game reliability, performance, playability and latency goal. A replacement host can now recover a winning session from its accepted feedback history even when the player checkpoint is absent, outdated, unrelated or forged. The broader goal remains active.

## Reproduction

The regression exercises the actual loaded-session reducer and `GameSessionCheckpoints`, using feedback that passes the strict bridge contract. First-, fifth- and paid sixth-attempt wins originally loaded as nonterminal sessions without a victory: **3 failed, 9 passed**. Run `pnpm_config_verify_deps_before_run=false pnpm --filter @qwordly/portal exec jest --config jest.config.cjs --runInBand src/play/__tests__/GameSessionCheckpoints.test.ts`.

The injected mounted-game baseline reproduces the missing victory with the captured original reducer after allowing the real lazy modal to mount. Subsequent regressions exposed older journal actions downgrading the confirmed win, initial terminal checkpoints being skipped, and an enabled Next action while recovered completion was still pending. Their failing logs are retained with the original source captures.

## Final behavior

- `ConfirmedRiddleOutcome` validates bounded host-accepted history and creates the existing stable completion identity. History must cover the accepted attempt count, preserve answer-width/grapheme shape and ordered attempts, obey the five-attempt/paid-sixth-attempt limits, and contain its only winning row last. Provider colours and presentation evaluation are insufficient proof.
- Loading that history immediately restores terminal state and victory. Missing or older provider data cannot replace it. Both journal restoration actions preserve a confirmed win, including a rollback carrying the actual pre-win riddle and snapshot.
- The checkpoint owner saves newly recovered completion intent immediately and clears it after acknowledgement. It bypasses stale provider restoration when the host already established terminal state.
- The final Next action for a host-recovered win waits for completion acknowledgement. Its event handler enforces the same condition. Ordinary provisional victories retain their existing early advancement through the issued question buffer; intermediate fanfare navigation remains available.
- Paid sixth-attempt recovery retains the existing visible-row reset, restores the winning row, and never requests another Continue charge. Actual completion results continue to control reward presentation and grants.

The helper uses a type-only bridge import and bounded proof checks; the full bridge parser remains at its existing boundary. An intermediate implementation imported that complete validator into startup, and the Jest artifact audit correctly rejected **0.65 MB** of initial resources against the unchanged **0.55 MB** limit. Removing that dependency restores the audited final artifact to **0.53 MB**. This avoids the introduced size regression; these local checks do not establish a production network-latency improvement.

No visible text, locale keys or provider SDK was added. Existing translated victory, reward collection and Next controls are reused. All six target isolation rules and server-authoritative economy boundaries remain enforced.

## Verification

The [machine-readable summary](../../../../artifacts/authority-terminal-recovery-2026-10-03/verification-summary.json) records final source SHA-256 fingerprints and these results:

- **2,953 unit/integration checks:** portal 2,604 in 294 suites, core 316 in 35 suites, backend authoritative session/transaction 33 in 2 suites. Portal reports 120 skipped checks. One differential regression compares **600 bounded winning-history cases** against the full bridge parser without adding that parser to startup.
- **1,260 injected browser assertions:** 582 in each development and production React mode, plus the previous pass’s 96 production guest terminal-reload assertions. The new matrix covers missing, stale, foreign and forged saves at attempts 1, 5 and 6, at 390×568, 390×844 and 1280×844. It checks canonical rows/colours, immediate pending checkpoints, held completion, disabled Next, original round identity, once-only progression, native reward collection/Next, fresh playable rounds, no repeated guesses/charges, and no browser errors. Separate negative cases refuse provider-only forged wins.
- **22 final built journeys in 4 suites:** Reddit guest/authenticated play, Jest hosted/profile-tour journeys, and queued coin actions including interrupted Continue recovery.
- Native Firefox verifies the final production implementation at 390×568 with a forged older player checkpoint and a genuinely granted sixth attempt. The canonical winning row survives, Next waits, the pending checkpoint contains attempt 6, and no guess or coin-spend request is replayed. Completion retries retain one request identity and apply one result. Native chest collection and fanfare Next open example 2, where native typing enters Q. Raw observations and independently checked `firefox-final-verified.json` are retained. An earlier Firefox run also covered the fifth-attempt stale-save case.
- All six final isolated artifacts build and pass their audits: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. Portal types, TSDoc (**24,947 declarations**) and whitespace checks pass. The React review confirms unconditional hooks, stable memo dependencies, native disabled controls, a guarded final advancement handler and preserved provisional advancement.

The new browser fixture uses actual guest authority methods for attempts 1 and 5. Its sixth-attempt scenario uses the existing fake paid authority, actual accepted guess results and an explicit idempotent fixture completion receipt. The host’s accepted history is deliberately independent of the player save. These are injected-provider checks, supported by backend session/transaction regressions; they do not claim live provider or production-network verification.

An intermediate browser run correctly stopped at the paid reward’s uncollected chest. The final fixture activates the chest natively before Next; it preserves the actual reward-collection gate. The failed trace is retained separately.

The source fingerprint audit caught a concurrent shared-workspace Continue recovery change before handoff. It was preserved and revalidated with the full portal suite, types, both terminal browser matrices, guest terminal reload checks, all six builds, the expanded built journeys and a fresh native Firefox journey. Six missing declaration comments were added to satisfy TSDoc. Final fingerprints include the shared reducer, action types and recovery hook; all remained stable through this verification. The shared Continue implementation is not attributed to this pass.

All owned validation processes are terminal, both owned fixture servers were stopped, and the owned Firefox tabs were closed while preserving the original about:blank tab. No commit, push, deployment or publication was performed.

Next investigation: mounted recovery when a durable pending-guess journal still carries the winning request after its host receipt was lost. Reducer protection is verified here; that complete transport-and-journal journey remains a separate check.
