# Checkpoint restore admission — 4 October 2026

Player edits and journal-recovered drafts now take precedence over older provider or retained checkpoints. A fresh authority load may restore saved gameplay once; after gameplay is edited, restored by the journal or scored, older checkpoint restoration cannot replace it. Utility-page updates preserve eligibility when the draft itself is unchanged.

## Reproduction and diagnosis

Final verification of the native-editor callback fix detected concurrent changes in game-session and checkpoint code. Those changes were preserved, and the global gates were rerun. The existing built browser journey `keeps skip usable with reject recovery` then failed: its durable `CL` draft at slot 2 was replaced by the original submitted `CRANE` draft at slot 0. The broader buffered-rejection verifier also reproduced `ZZZZZ` replacing `CL`.

Two synchronous checkpoint/reducer loops isolate the orderings. In one, the checkpoint owner captures a restore action before journal recovery, and the action reaches the reducer afterward. In the other, the journal has already recovered its draft before the checkpoint owner decides whether to restore. Both original loops overwrite the newer draft, including an explicitly empty recovered draft.

```sh
pnpm_config_verify_deps_before_run=false pnpm --dir packages/portal exec jest \
  --config jest.config.cjs --runInBand --silent \
  src/play/__tests__/GameSessionCheckpoints.test.ts \
  --testNamePattern='keeps journal-recovered drafts'
```

The first minimized loop failed twice before the fix. Ranked explanations were an older restore overtaking journal recovery, a wrongly retained journal draft, or a browser timing artifact. Synchronous reduction rules out the timing explanation. A draft-reference admission guard fixed the queued-Skip journey but left the already-recovered buffered case failing; it did not prevent choosing an obsolete restoration after current gameplay was already owned. The final implementation makes that eligibility explicit.

## Change

`GameSessionState.canRestoreCheckpoint` starts false and becomes true only on a fresh authority load. Valid letter edits, deletions, slot selection, scoring, journal restoration, rollback and successful checkpoint restoration retire that eligibility. Both `GameSessionCheckpoints.update` and the reducer's `restoreSession` admission require it. This protects current gameplay whether recovery occurs before the restore decision or before its queued action is reduced.

The field belongs to the in-memory reducer state. Saved-game and pending-journal wire formats remain unchanged. Current hint locks, authoritative histories, account ownership, profile balances and utility-page ownership retain their existing rules.

Six new unit cases cover populated and empty drafts in both orderings, later slot selection and an unchanged draft that still restores while Settings remains open. No visible text or provider integration changed.

## Verification

| Check | Result |
| --- | --- |
| Targeted checkpoint/reducer units | 111 passed, including six new cases |
| Buffered rejection browser coverage | 840 assertions in development StrictMode and production |
| Cold draft and journal restoration coverage | 732 assertions in both modes |
| Browser viewports | 390×568, 390×844, 1280×844 |
| Full portal units | 2,756 passed in 297 suites; 121 optional browser tests skipped |
| Current built game journeys | 37 passed in seven suites, including the previously failing rejected Skip |
| Types and documentation | Passed; 25,248 declarations documented across 1,139 files |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix candidate and Yahoo candidate passed |
| Final source stability | Independently collected 766-path inventories and hashes match |

Native Firefox at 390×568 dismissed the completed predecessor's reward and achievements using the actual controls. The successor initially showed the provisional `ZZZZZ` row and a `CL` draft at slot 2. Rejecting the retained successor request removed the provisional row while keeping `CL`, slot 2 and the acknowledged 325-coin balance. Releasing same-session authority reconciliation preserved those values. Native `o` extended the draft and durable journal to `CLO` at slot 3. Only the original retained request identity was observed, including its bounded retransmissions. Four raw observations were parsed and asserted with no browser error or unhandled promise.

The owned Firefox tab was closed, the original blank tab preserved, and the fixture stopped with its scratch directory removed. Captures, failed built journey, minimized unit failures, intermediate guard evidence, final source diff, recovery reports and asserted Firefox proof are under `artifacts/checkpoint-restore-admission-2026-10-04`. Final global gate logs and the stable source epoch are under `artifacts/native-editor-callbacks-2026-10-04`.

The combined pass verifies 5,832 injected browser assertions across native-editor and recovery checks. These are controlled adapter journeys; no live-provider latency or operating-system IME behavior is claimed. The broader improvement goal remains active.
