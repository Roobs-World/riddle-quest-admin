# Multiplayer loader lifetime ownership

30 September 2026 local development evidence. Named HTML5 platform artifacts only;
no standalone web/PWA release, visible text or locale changes.

## Reproduced lifecycle failures

Four public Race Session regressions failed before correction. An observer could
submit the successor when pending state was released, after which the older
response handler scheduled cleanup against the new guess. A retained cancelled
loader callback could clear the loader for a newer guess in the same run or after
account replacement. Following disposal, a retained callback still notified
session observers.

The delivery timer already had private ownership independent of mutation receipt
identity. The loader tail now has its own attempt generation. Starting a guess,
replacing a tail or disposing invalidates older callbacks before they can clear
handles, result-loading state or visible loading state. Response completion checks
its generation again after notifying observers, so a reentrant successor cannot
inherit its older handler's cleanup. The established minimum loader interval and
outcome handoff remain supported.

## Verification

All 382 client race cases pass, including the four reproduced regressions, prior
delivery-retry guards, outcome handoff and original loader timing cases. The
repository declaration audit passes.

`packages/portal/scripts/verify-race-loader-browser.mjs` renders the real UI with a
controlled clock adapter retaining cancelled loader tails. At 1280px and 390px it
accepts a wrong guess, submits a correct guess in the same run or changes account
and starts a new run, then confirms the new guess. Invoking the older queued tail
cannot hide the current post-confirmation loader. Invoking the current tail clears
it normally; the confirmed successor remains question two without an error or
browser exception. All four cases pass. Account replacement explicitly focuses
the new editable cell before typing; the first fixture attempt omitted that focus
and timed out before sending its second guess. This was corrected in the harness.
Screenshots are under `artifacts/race-loader/`; the settled mobile account-change
view was visually inspected.

Stable completion recording uses
`docs/development-tasks/race-loader-lifetime-ownership.json` for fifteen checks,
including backend race emulator/operator safeguards, core/client tests, types,
lint, the injected UI cases, all seven isolated platform artifacts and repository
and dependency safeguards. A dashboard completion record requires every check to
pass against unchanged source. No upload, activation, publication or Functions
deployment is performed by these commands. Jest build activation and Firebase
Functions deployment are authorized; game publication, review submission and
listing visibility remain held. The broader multiplayer reliability audit remains
active.

The first fourteen-check run passed every required command but withheld its
completion record because concurrent work changed backend callable regions and
client Firebase routing, with corresponding tests. Those changes are preserved
and are not attributed to this loader fix. Recording is repeated against the
current source, adding the focused Firebase target-routing suite so the current
shared client configuration is explicitly checked.
