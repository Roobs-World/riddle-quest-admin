# Live multiplayer draft recovery — 2026-10-09

The current live multiplayer UI now recovers an unsent partial answer when an authoritative rejoin returns the same account, ticket, run, locale, question, position and accepted-guess count. Previously the same recovered seat displayed blank cells. Recovery never sends a stored command.

`liveRaceDraftStorage.ts` stores one bounded account-specific presentation record: version, exact binding, letters, cursor and local saved time. Records expire after thirty minutes, reject future timestamps, malformed cells, extra fields and mismatched widths. Canonical hints replace their own cells and repair a locked cursor. Changed accepted attempt counts reject stale submitted drafts. Other accounts, new questions and terminal seats cannot inherit the input.

The UI checkpoints committed drafts and final pagehide edits. Explicit close, terminal observations and real component retirement clear only the exact observed storage revision. Optional storage failures do not block gameplay; denied writes can retry, and competing tab revisions revoke overwrite and cleanup permission. Unchanged successful content avoids duplicate setItem calls. No authoritative progress, request IDs, commands, answer solutions, histories or economy data enter the checkpoint. No visible text or target adapter contract changed.

## Verification

- 32 focused tests across draft reconciliation and the new persistence boundary.
- Full client suite: 3,084 passed; 96 browser-gated tests skipped in that command, with rendered checks run separately below.
- Chromium 153.0.8010.12 and Firefox 153.0, React development/production, widths 390/1280: 56 injected browser journeys, 304 assertions. Eight initial recovery journeys plus 48 boundary journeys cover same-seat reload, accepted wrong guesses, question advancement, account changes, denied storage and explicit close.
- The exact pre-change screen, SHA-256 matched to the preceding audit, fails the recovery probe because the expected `te` becomes blank. One intended assertion failure; no claim that a green diagnosis probe alone proves recovery.
- Types, TSDoc and maintainable file sizes pass. The initial TSDoc audit identified undocumented new declarations; they were documented before the final source freeze.
- All six isolated target artifacts and the Devvit server build successfully. Jest/Reddit rendered suites pass 22 checks; the separate Facebook fixture passes one. Target-specific artifact audits ran in their build commands.
- 2,506 selected source inputs match before, terminal and verified manifests. 1,299 files from the six-target/server cohort and seven dependency inventories are archived. All jobs reached terminal results. Owned build roots and metadata were removed; the Facebook test itself removed its temporary fixture. The first archive attempt incorrectly expected that fixture still to exist, stopped before any copying/removal, then was corrected to archive the existing cohort and verify the fixture's absence.

Run `python3 artifacts/live-draft-recovery-fix-2026-10-09/verify.py` from the repository root to verify the evidence.

## Limits

The injected browser HTTP fixture supplies canonical seat continuity and uses the legacy ticket-based adapter. These runs prove current UI recovery and rejection behavior under those inputs; they do not measure production reload frequency, cloud latency or modern retirement-aware provider transport end to end. Existing modern retirement authority remains unchanged. No deployment occurred. The broader reliability/performance/playability goal remains active.
