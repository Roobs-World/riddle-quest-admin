# Live race render work — 4 October 2026

The live multiplayer render path no longer samples initial clock values on every render or rebuilds unchanged keyboard feedback during answer edits. Clock receipt updates remain mutable and authoritative. Fresh confirmed-guess arrays recompute keyboard colors, including clearing the previous prompt's feedback.

## Reproduction and diagnosis

The injected browser mounts the actual hosted single-player, live multiplayer and local playable applications. The fixture transparently counts the two initial wall-clock expressions and initial monotonic expression in `LiveRaceGame`, and wraps the real `getRaceLetterStates` helper without altering its input or result. It must observe all three initial sources on a mounted race. The other two applications are negative controls.

```sh
pnpm_config_verify_deps_before_run=false LIVE_RENDER_QUICK=1 \
  LIVE_RENDER_TARGETS=race LIVE_RENDER_SCENARIOS=typing \
  LIVE_RENDER_REPORT_DIR=artifacts/live-render-work-2026-10-04/red-typing \
  node packages/portal/scripts/verify-live-render-work-browser.mjs
```

The original development loop fails after two physical editing transitions with eight wall-clock reads, four initial monotonic reads and four feedback reductions. Minimizing to a single parent update preserves the failure, without further typing: four wall-clock reads, two initial monotonic reads and two reductions.

Three hypotheses were ranked before production controls: eager render evaluation repeats initialization and reduction; a legitimate new receipt requires the work; or StrictMode alone creates it. Production reproduces 64 wall-clock reads, 32 initial monotonic reads and 32 feedback reductions during 32 typing transitions. Parent-only updates reproduce the same counts. Separate staged controls isolate the sources: lazy clocks alone leave only the repeated feedback reductions; feedback memoization alone leaves only the repeated clock initialization. Both fixes together remove all three counts.

## Change

`now` and the mutable initial clock-anchor holder use lazy state initializers. Accepted receipts still replace the anchor's `current` value and advance `now` exactly as before. The keyboard state uses `useMemo` keyed by the authoritative confirmed-guess array; its reducer remains unchanged. Null or absent guess histories retain an empty presentation, and fresh receipt arrays invalidate the cache.

The change is confined to `LiveRaceGame`, plus the browser verifier and its registration. No input handling, visible text, scoring, provider integration or actual operation ID generation changed.

## Verification

Original and updated production surveys have identical keys for all 669 assertions. The original fails twelve repeated-work assertions; all other controls pass. Updated development StrictMode and production pass every assertion. Coverage includes physical edits, shortcut clicks, ordinary parent updates, confirmed feedback, fresh mounts, once-only submission and stable delivered join/leave IDs. The confirmed Z key retains its color during updates and clears when a successful answer advances the authoritative prompt.

| Check | Result |
| --- | --- |
| New injected browser coverage | 84 journeys / 1,338 assertions |
| Modes and viewports | Development StrictMode and production; 390×568, 390×844, 1280×844 |
| Visible/hidden clock regressions | 396 assertions |
| Mounted identity regressions | 1,164 assertions |
| Live reconnect regressions | 708 assertions |
| Total injected browser assertions | 3,606 |
| Stale server-clock controls | Two browser journeys; repeated older observations cannot restart the countdown |
| Portal units | 2,727 passed in 296 suites; 121 optional browser tests skipped |
| Current built game journeys | 37 passed in seven suites |
| Types and documentation | Passed; 25,178 declarations documented across 1,138 files |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix candidate and Yahoo candidate passed |
| Stable source inputs | Independently collected 765-path inventories and hashes match |

Native Firefox at 390×568 submitted a wrong word and observed the actual Z key turn red. A parent update retained editor focus and performed zero repeated clock initialization or feedback reduction. Native typing then retained `pian`, the same focused editor and the red Z key, with zero initial clock reads. Seven background polls arrived during that observation window and caused exactly seven feedback reductions; typing added none. Native `o` and Enter advanced the race once to 1/10 and cleared the old Z feedback. All four raw observations were parsed and asserted, with no browser errors or unhandled promises.

The correct-answer transition replaced the question-owned native editor, and the sampled replacement lacked focus. This is retained as evidence for the next playability investigation; focus continuity claims here cover editing and parent updates only.

The owned Firefox tab was closed, the original blank tab preserved, and the fixture stopped with its scratch directory removed. The unchanged stale-clock verifier was run from a temporary sibling with only its report destination redirected; that sibling was removed. Its captured source and reports remain under the evidence directory. Production instrumentation is confined to the injected fixture.

Captures, failed loops, staged controls, exact source diff, production comparison, screenshots, asserted Firefox proof and gate summary are in `artifacts/live-render-work-2026-10-04`. The new regression runs in the game browser verification chain. These are local operation-count measurements; no frame-rate or live-provider latency gain is claimed. The broader improvement goal remains active.
