# Concurrent instance receipt recovery fix

Another instance could consume the checkpointed word while an earlier receipt lookup was pending. The historical receipt remained accepted, and the next server poll promoted the consumed word into a newer checkpoint. The pre-fix injected Chromium/Firefox reproduction is recorded separately in `live-receipt-concurrent-acceptance-audit-2026-10-09.md`.

The read-only backend lookup now requires the owned active run to remain on the exact question and accepted count, with no terminal match winner. Immutable historical receipts are preserved. The client marks restored presentation with a transient accepted-count version. A later canonical count change clears untouched restored cells while preserving confirmed hints. Changed player-authored letters retain normal independent intent; cursor movement alone cannot keep stale recovery alive. The transient marker is never persisted or sent to a provider, and no command is replayed.

## Verification

- Red client regressions: two failures with 22 existing tests passing. Red actual SDK regression: one failure with 33 existing tests passing.
- Final focused client regressions: 62 tests; full client suite: 3,120 passed, 96 browser-gated tests skipped; full backend unit suite: 1,769 passed.
- Final actual Firestore/RTDB/Storage SDK selection: 39 tests in three receipt/proof/gateway suites passed. The preceding complete backend baseline passed 1,290 tests in 91 suites; that broad run predates this localized fix and is not presented as a post-fix full SDK run.
- Injected production browser concurrency regression: four journeys / 44 assertions across Chromium 153 and Firefox 153 at 390 and 1280 pixels. The fixture deliberately still permits historical acceptance, verifying the client also handles an older backend or acceptance after the proof snapshot.
- Chromium production compatibility: 44 journeys / 306 assertions covering independent recovery, hint locks, question changes, account replacement, retirement, competing writers, deadline fallback, failed clearing, storage boundaries and polling work. Total executed browser journeys in this fix cohort: 48 / 350 assertions.
- Six isolated target builds plus Devvit passed, with 1,299 archived output files and seven dependency metadata files. Backend isolated compilation on Node 22.23.1 passed with 398 archived outputs. Rendered standards passed 22 hosted/Jest/Reddit cases plus one Facebook SDK lifecycle case using its separate 13-plus fixture.
- TSDoc and file-size audits passed. All 2,525 final selected source hashes match the final freeze. Full unit/build/browser behavior was verified before test-comment-only documentation repairs; the exact final SDK regression source was rerun afterward. Production inputs remained identical throughout those verification runs.
- The installed Firefox binary was specified after the first launch requested an uncached browser revision. No browser installation was needed. TSDoc test comments were repaired and audited successfully.
- Owned build/compile/13-plus fixture outputs and seven metadata files were archived and removed. The successful emulator wrapper removed its temporary directory; all six emulator ports were confirmed closed in the host namespace.

Artifacts and executable verifier: `artifacts/live-receipt-concurrency-fix-2026-10-09/`. No deployment, push, commit or publication was made. These local injected/emulator checks do not measure cloud latency. The wider improvement goal remains active.

## Native Firefox follow-up

Firefox MCP 157 confirmed the concurrent-acceptance interleaving against a production React injected fixture: original accepted count one, independent full-word checkpoint at count zero with the original locator, competing request accepted at count two while proof is pending, proof released within three milliseconds, restored word observed in the DOM, then a fresh canonical poll clears both editable and persisted cells at count two. Exactly one original receipt lookup occurred, with no automatic guess, browser error or unhandled rejection. The fixture deliberately permits historical receipt acceptance to exercise client protection independently of the tightened backend gate.

The first manual attempt could have timed out because of tool round-trip delay and was not counted as concurrency evidence. A deterministic fixture callback provided the validated follow-up; no UI action was synthesized through script evaluation. The owned native tab was closed, fake-account storage removed, both local fixture listeners confirmed closed, and their scratch directories removed. Evidence: `artifacts/backend-concurrency-current-full-sdk-2026-10-09/native-firefox-proof.json`.
