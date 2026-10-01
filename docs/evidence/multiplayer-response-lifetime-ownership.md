# Multiplayer response lifetime ownership

30 September 2026 local development evidence. Scope remains named HTML5 platform
artifacts, excluding standalone web/PWA release. No UI copy or locale keys change.

## Confirmed account replacement defects

Three public-interface regressions reproduced real ownership failures before
correction. An observer changing account while a start was accepted left the old
start retry in the replacement journey. An optional start analytics effect changing
account allowed the next old start effect to run through the replacement adapter.
An outcome analytics effect changing account likewise allowed further old outcome
effects to run after replacement.

The first publication case also failed, but its preview claimed a 60-second finish
while the fixture's terminal run claimed zero seconds. That was a fixture error,
not evidence of the ownership defect. The terminal fixture now has the same
60-second finish as its valid publication preview. The publication effect case
passes with the corrected fixture and protects the same ownership rule.

## Correction

Accepted response processing captures its original session generation. State
observers, persistence callbacks, chained host delivery and optional effects can
replace the account or navigate synchronously. Follow-up authority work and final
retry/loader/result cleanup stop when that generation is no longer current.
Rollback rechecks ownership after publishing its checkpoint, preventing the old
error from being applied to a replacement journey. Readiness and abandonment
follow-ups likewise stop after ownership changes. Optional start, outcome and
publication effects are checked between successive adapter calls, preserving
committed authority without attributing old effects to a new account.

## Verification

All 389 client race cases pass. Seven new cases cover account replacement during
accepted start observation; during hint, skip and guess rollback; and during start,
outcome or publication effects. The replacement account retains its own category
request, no old error or effect appears, and retry requests its catalog rather
than replaying the previous account's start. Existing normal lifecycle, duplicate
receipt, thrown optional-adapter, loader and result-effect checks remain passing.

`packages/portal/scripts/verify-race-reentry-browser.mjs` renders the real UI. A
controlled host synchronously replaces the React account during the accepted start
analytics callback, then rejects the new account's first catalog read. At 1280px
and 390px, retry requests the new catalog, never replays the old start, suppresses
old attempt analytics, and then starts the new account's run normally. Both cases
pass without browser exceptions or visible errors after recovery. Screenshots are
under `artifacts/race-reentry/`; the mobile replacement run was visually inspected.

Stable recording uses
`docs/development-tasks/race-response-lifetime-ownership.json` for fifteen checks:
backend emulator/operator safeguards, core/client and Firebase routing tests,
types/lint, injected UI, seven isolated artifacts and repository/dependency
safeguards. A local dashboard completion row requires every check to pass against
unchanged source. These commands perform no upload, activation, publication or
Functions deployment. Jest build activation and Firebase Functions deployment
are authorized; game publication, review submission and listing visibility remain
held. The broader multiplayer reliability audit remains active.

The first fifteen-check run passed every required command, but correctly withheld
completion because concurrent work updated
`docs/evidence/multiplayer-live-fixes-2026-09-30.md` during verification. That update
is preserved; stable recording is repeated without weakening source checks.
