# Live multiplayer draft recovery audit — 2026-10-09

This pass traced the current multiplayer UI before attempting checkpoint optimizations. No production source changed. The retained RaceDrafts disk-storage helper is not called by LiveRaceGame; optimizing it would not reduce current live gameplay storage work.

## Observed ownership

- `useLiveRaceDraft` initializes an empty draft and owns it with React state and a ref. It does not read or write persistent storage.
- `LiveRaceGame.apply` passes the previous authoritative view into `reconcileLiveRaceDraft`. The first accepted view after a fresh mount has no previous view, so reconciliation creates an empty draft with canonical hint locks.
- Subsequent same-ticket/run/locale/question observations retain unsent letters. Changes in seat, run, locale, question, position, width or terminal phase reset the draft.
- `joinLiveRaceForUser` reads the account active-seat pointer and can return the existing unfinished compatible seat for a new join request. Server progress can therefore survive a fresh UI mount while local unsent letters do not.
- A real React unmount also starts owned seat retirement. Reload, explicit close, account replacement and interrupted transport must be distinguished before designing recovery. This audit does not establish which native reload paths return the original seat.

## Verification and limits

The current `liveRaceDraft.test.ts` suite passed: 19 tests, one suite. It covers receipt reconciliation, ownership changes, definitive rejection, edit intent and hint cursor recovery. The existing reconnect browser harness covers held commands, polls, retries, rejection, owner replacement and close; its scenario list does not include reload.

Evidence: `artifacts/live-draft-recovery-audit-2026-10-09/unit.log` and `source-observed.json`. The hashes are a post-observation snapshot, not a pre-run freeze manifest. No browser reload reproduction, natural device failure rate or player latency measurement is claimed. No target build was needed because this pass changed only evidence files.

## Next verifiable step

Add an injected current-live browser journey that types a partial word, performs a native reload and rejoins the same account. Record the actual ticket/run/question identity and canonical attempt history before and after. Only restore a draft when the recovered authority matches its full ownership binding; never replay an accepted guess from a stale checkpoint. Include account replacement, question advancement, storage denial and explicit close as negative cases before enabling persistent recovery.

## Injected native reload reproduction

The artifact-only `reload-probe.mjs` uses the current RaceTo10Game/LiveRaceGame UI and an HTTP fixture retaining the canonical seat across a page reload. Playwright performed a native page reload, then clicked the existing Start PvP match button. Chromium 153.0.8010.12 and Firefox 153.0 both reproduced the loss in React development and production, at widths 390 and 1280: eight journeys, 48 checks. The partial `te` draft became four empty cells while ticket ID, run ID, locale, riddle ID, position and accepted attempt count remained identical. No guess was replayed; no browser error or unhandled rejection occurred.

All four processes completed successfully and their browsers, servers and owned temporary bundles were closed/removed in finally blocks. `reload-summary.json` records the result. The seven observed production/test inputs retained their earlier SHA-256 hashes after the browser runs. This is diagnosis, so the observation explicitly expects the existing loss; it is not a passing regression test asserting desired recovery.

The fixture uses the legacy injected live adapter with ticket-based retirement, not the production provider adapter or a real Firebase transaction. It proves current UI draft loss when authority returns the same seat, not production reload frequency, modern retirement-aware delivery behavior, or end-to-end cloud recovery. A recovery change must still preserve modern join retirement ownership and never replay pending accepted commands. No production source or UI changed in this pass.
