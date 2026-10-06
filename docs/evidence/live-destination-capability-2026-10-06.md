# Live destination capability and keyboard recovery — 6 October 2026

Verified client change in the active `RaceTournamentEntry` used by Facebook and Reddit. When the selected Activity or Tournaments capability disappears, the committed screen now selects Play, renders the actual category surface, and retains one keyboard entry. Reintroducing the capability does not reopen the old destination automatically. A native chooser failure started on the departed tab is retired when fallback commits, while the original native dialog remains locked until it settles. An abandoned prepared fallback preserves the original screen and its valid chooser feedback.

Native Home and End also focus their destination immediately when that destination is already selected. Selection changes retain the existing deferred focus restoration and its protection for later Tab and Enter actions. This is a reliability and keyboard playability improvement; no network latency reduction is claimed.

## Diagnosis and controlled evidence

Evidence is under `artifacts/live-destination-capability-2026-10-06/`. These are real Vite/React browser harnesses using the active component, validated standings/history responses and the real fake-service category catalog. They do not exercise the inactive recorded-race UI.

The initial ranked explanations were unsupported stored selection, unretired native chooser feedback, and a tab-only change leaving the wrong pane. The minimal original-source reproductions fail 7 of 12 checks in both React modes. Adding a held native chooser exposes 11 failures in 18 checks. Selection alignment alone leaves one failure: the old native chooser error reaches Play. Advancing the navigation revision in a layout effect on committed destination changes resolves it without retiring feedback from abandoned renders.

The expanded keyboard checks then fail in five cases, all for End targeting the already selected destination from another focused tab. The ranked explanations were unchanged effect dependencies, delayed restoration, and the modal focus guard. Waiting twenty additional animation frames retains focus on Play in those same cases. Focusing the existing tab synchronously for an unchanged selection resolves the defect. Repeated End and Home now explicitly verify immediate focus.

Retained diagnostics include the selection-only intermediate result, the delayed-focus result, and the original helper that initially used the wrong English chooser label. The label timeout is a harness mistake, not a product failure. That incomplete attempt is not counted as a completed regression matrix. Final original-source replays retain 11 failures per 18 checks; final candidate replays pass all 18 in each React mode.

## Frozen candidate verification

- New maintained harness: 144 cases, 1,920 assertions and 144 screenshots across Chromium 153 and native Firefox 153, development and production React, three viewports, two destinations, and six capability/chooser/abandonment scenarios. All pass; no external provider traffic, browser exceptions or unhandled rejections are observed.
- Existing navigation focus harness: 72 cases and 1,044 assertions in both React modes pass, including later Tab and Enter ownership. The six final minimal candidate cases add 36 passing assertions.
- All portal units pass: 2,898 tests; 93 skipped. The built Jest/Reddit browser suite passes 22 tests, including queued coin actions; the Facebook artifact fixture adds one passing test.
- All six isolated target builds and the Devvit server build pass. The YouTube build uses the fixture command; this is not release certification.
- Type, target boundary, security configuration, TSDoc and file-size audits pass. TSDoc reports 26,583 documented declarations; the file-size audit covers 1,265 source files.

`source-before.json` freezes 2,452 selected source inputs after preflight. The identical after-build, runtime-terminal and terminal manifests prove no selected input changed during final verification. The prior 2,451-input baseline and three owned before/after records reproduce the exact patch: `RaceTournamentEntry.tsx`, package-script registration, and the new maintained browser harness. The reverse patch check passes against the current checkout. Existing dirty work is preserved.

Backend, core and SDK evidence is reused rather than freshly rerun: all 824 selected authority inputs and 24 compiled core copies remain byte-identical. The preserved authority logs prove the earlier 391 core, 1,730 backend, 677 SDK integration and 17 Node 22 SDK tests; this does not claim a fresh run of every registered SDK suite.

The active entry module is included only in Facebook and Reddit among the six target inventories. Isolation audits and retained inventories verify the provider restrictions. No visible production copy, server API, authority, purchase grant, scoring or economy behavior changes.

## Preservation and completion of this pass

All 15 tracked final jobs reached terminal status. Both deliberately failing original-source replay jobs exited 1; the other 13 exited 0. All 1,301 output files are retained under `built/` and verified by `built-sha256.json`. Six build dependency inventories and one Facebook browser-fixture inventory were copied and hashed before their exact owned originals were removed. The exact owned temporary build root and browser scratch directories are gone. No commit, push or deployment was performed.

Reproduce the evidence audit from the repository root:

```sh
python3 artifacts/live-destination-capability-2026-10-06/verify.py
```

The broader improvement goal remains active. Further candidates include active rematch ownership across provider changes and tournament-read admission during retired effects; they require their own reproductions before a fix. The earlier live retirement backend protocol still requires backend/Devvit deployment before releasing those previously changed clients; this pass performs no deployment.
