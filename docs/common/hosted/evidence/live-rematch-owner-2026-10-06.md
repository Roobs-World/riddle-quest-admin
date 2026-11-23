# Active history rematch ownership — 6 October 2026

The active `RaceTournamentEntry` now ties a history rematch selection to the provider and rematch operation that admitted it. A committed provider change, operation replacement or operation withdrawal clears the selection before children commit and returns to the actual Play category surface. Restoring the provider or operation cannot reopen the retired journey. The mounted game receives the captured original transport, and its existing retirement mechanism cleans up through the original provider.

Ordinary profile updates and stable renders retain the game, draft and subscription. A prepared replacement that is abandoned preserves the committed game and can accept its original terminal receipt. A subsequent result-screen rematch uses the original provider and the newly completed source ticket. A fresh explicit rematch after real retirement uses an independent admission key and remains playable.

## Reproduction and diagnosis

Evidence: `artifacts/live-rematch-owner-2026-10-06/`. The browser uses real React StrictMode, Vite, `RaceTournamentEntry`, Activity, history selection and `LiveRaceGame`. Fixture receipts validate against the actual schemas; the category catalog comes from the real fake-service catalog. Native clicks and native keyboard input drive the actual UI. The inactive recorded-race destination is not used.

The minimal original-source provider replacement sends the old live ticket to the new adapter, retains the old selected journey, replaces its subscription with one on the new provider, and fails to retire its original seat. Capability removal followed by restoration automatically starts a second rematch without explicit selection. The first minimized run fails 7 of 16 assertions. Replacing the clone-based capability fixture with removal on the same adapter object retains those same seven failures; production React reproduces them too.

The ranked explanations were missing provider ownership in the stored selection, missing capability retirement, and cleanup failing to retire the original seat. Capturing the provider and operation in selection state and aligning that state during rendering resolves all three observed consequences. The existing cleanup code is unchanged: actual unmount now permits it to retire the original seat correctly. Conditional React state alignment preserves ownership during abandoned work, rather than mutating committed ownership from a prepared render.

Final original-source replays still fail 7 of 16 checks in each React mode. Final candidate replays pass all 16 in each mode.

Three expanded harness corrections are preserved separately. The first held every Alice rematch, including the new explicit request, and timed out after 82 passing observations. The second awaited visibility of a nonvisual version-marker wrapper and timed out after 119 observations. Both are fixture failures, not product defects. A third completed 142 observations but incorrectly expected no cleanup leave when a terminal receipt was still unobserved. The last accepted state was nonterminal, so one original-provider leave is valid. The final regression asserts exactly that original-provider cleanup and no replacement-profile refresh. It passes all 142 preflight assertions.

## Frozen verification

- New maintained regression: 108 cases, 1,704 assertions and 108 screenshots across Chromium 153 and native Firefox 153, development and production React, three viewports and nine scenarios. All pass. Scenarios cover provider change, same-object capability removal, same-object operation replacement, pending rematch receipts, commit-time terminal settlement, profile updates, 16 stable updates and abandoned replacement. Retained and fresh journeys submit native answers and confirm authoritative advancement.
- Adjacent active-history regressions: 48 cases and 570 assertions in development and production Chromium pass.
- Adjacent capability/navigation regressions: 72 cases and 960 assertions in development and production Chromium pass. These retain the previous fallback, chooser, restoration, abandoned-render and Home/End fixes.
- Final minimized candidate replays: four cases and 32 passing assertions. Across these final browser regressions there are 232 cases and 3,266 assertions. The new and adjacent harnesses observe no external provider traffic, browser exceptions or unhandled rejections.
- Portal units: 2,898 pass, 93 skipped. Built Jest/Reddit browser tests: 22 pass; the built Facebook fixture adds one passing test.
- Six isolated target builds plus Devvit server pass. YouTube uses the fixture build and is not release certification.
- Type, boundary, security, TSDoc and file-size audits pass: 26,586 documented declarations and 1,265 source files.

The final candidate freezes 2,453 selected source inputs. Identical after-build, runtime-terminal and terminal manifests verify no selected source edits during final verification. The previous verified 2,452-input state is retained as the baseline. Three owned source records capture the exact patch: the active entry, browser-script registration and the new maintained regression. Reverse patch validation succeeds against the current checkout; earlier dirty work is preserved.

All 824 selected authority inputs and 24 canonical/installed compiled core copies are unchanged. Earlier authority logs are reused by byte hash: 391 core tests, 1,730 backend tests, 677 SDK integration tests and 17 Node 22 SDK tests. These are reused results, not fresh runs, and do not represent every registered SDK suite.

No production copy, translations, scoring, purchase grants, account exchange, economy or backend API changes. The changed entry appears only in Facebook and Reddit among the six target dependency inventories. Target isolation audits retain the provider restrictions.

## Retained evidence and cleanup

All 17 tracked final jobs are terminal: the two deliberately failing original-source replays exit 1 and the other 15 exit 0. All 1,301 built files are copied under `built/` and verified by SHA-256. Six target dependency inventories and one Facebook fixture inventory are preserved and hashed before their exact owned originals are removed. The exact temporary build root and owned browser scratch directories are removed after terminal jobs and preservation checks. No commit, push or deployment was performed.

Revalidate from the repository root:

```sh
python3 artifacts/live-rematch-owner-2026-10-06/verify.py
```

This verified pass leaves the broader goal active. Tournament read admission and provider ownership remain candidates for a separate reproduction. The previously implemented live-retirement backend protocol still requires backend/Devvit deployment before release of those previously changed clients; this pass deploys nothing.
