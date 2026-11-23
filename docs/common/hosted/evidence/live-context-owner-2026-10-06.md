# Activity context projection ownership — 6 October 2026

The Activity context standings now own a provider, read method, notification method and language lifetime independently of the modal and global live history. A replacement clears old standings and errors before children commit. Retired notifications cannot clear a replacement projection or issue another read. Deferred reads check ownership before invoking the captured original method with its original provider receiver, and retired responses are ignored before parsing.

The Activity modal, history row and selected-tab focus remain stable across context-only changes. Context replacement, withdrawal and native refresh do not make a new history request. The retained history row still opens its native rematch through the unchanged transport and source ticket. A current context notification refreshes only its own standings, including when an older response settles immediately after notification.

The development StrictMode reproduction previously issued two context reads for one mounted lifetime. It now issues one. This is an observed development request-count improvement, not a measured production network latency claim.

## Reproduction and diagnosis

Evidence: `artifacts/live-context-owner-2026-10-06/`. Real Vite/React and the active `RaceTournamentEntry` drive Activity, context standings, `LiveRaceHistory` and native rematch controls. The fixtures use strict schema-valid context/history/terminal receipts and native UI actions. They do not exercise inactive recorded-race UI or contact actual provider SDK services.

The three minimized cases cover initial reads, provider replacement, and replay of a retained original notification after replacement. Original development source fails 7 of 22 checks: three duplicate reads, two stale context projections during commit, one extra replacement read from an old notification, and one erased replacement row. Original production source fails the four ownership checks. Final original-source replays retain those failures in both modes. Final candidate replays pass all 22 checks in each mode.

The ranked explanations were unguarded deferred admission, provider-shared context state and notifications without lifetime retirement. The fix extracts just the context projection into a private ownership wrapper and panel. Keying the entire Activity modal would unnecessarily reset history and focus, so the new boundary owns only context rows, errors, read deadlines and notifications. Guards retire notification registrations and committed panels; the existing synchronous context-generation check still rejects an old receipt before effect cleanup. Original provider methods and response validation remain intact.

Retained callback replay deliberately models a notification already queued when unsubscribe occurs. The expanded fixture supplies actual unsubscribe counters and verifies current-channel subscription ownership and complete retirement when leaving Activity. The expanded preflight passes 14 cases and 233 checks without fixture repairs.

## Frozen verification

- New maintained regression: 168 cases, 2,796 assertions and 168 Activity screenshots across Chromium 153 and native Firefox 153, development and production React, and three viewports. Fourteen scenarios cover initial reads, provider/read/notification-method replacement, pending and failed old reads, a null context response, capability withdrawal, profile updates, 16 stable updates, abandoned replacement, retired notifications, current notifications and a pending-response notification race.
- Every scenario verifies independent history identity and its single read, stable modal identity, native rematch source ticket, context subscription retirement, no external provider traffic, no browser exception and no unhandled rejection. Current native refresh also preserves selected-tab focus.
- Adjacent Chromium regressions in both React modes pass: navigation 72 cases/1,044 assertions, capability withdrawal/restoration 72/960, history ownership 48/570, and rematch ownership/playability 54/852.
- Final minimized candidate replays add six cases and 44 passing assertions. The final browser regressions total 420 cases and 6,266 assertions.
- All portal units pass: 2,898 tests, 93 skipped. Built Jest/Reddit browser tests pass 22 tests; the Facebook artifact fixture adds one passing test.
- Six isolated target builds and the Devvit server pass. YouTube uses the fixture build command; this is not release certification.
- Type, target boundary, security, TSDoc and file-size audits pass: 26,599 documented declarations and 1,265 source files.

The candidate freezes 2,455 selected source inputs. After-build, runtime-terminal and terminal manifests match that freeze exactly. The prior verified 2,454-input baseline and three owned before/after records reproduce the exact patch: `RaceContextBoard.tsx`, package-script registration, and the maintained regression. Reverse patch validation succeeds against the current checkout. Earlier dirty work is preserved.

Backend/core/SDK evidence is reused by byte hash. All 824 selected authority inputs and 24 canonical/installed compiled core copies remain unchanged. Prior logs prove 391 core tests, 1,730 backend tests, 677 SDK integration tests and 17 Node 22 SDK tests. They are reused results, not fresh runs or a claim that every registered SDK suite ran.

No production copy, translations, scoring, purchase grants, identity exchange, economy or backend API changes. The changed context module appears only in Facebook and Reddit among the six dependency inventories. Boundary audits and preserved inventories verify the target restrictions.

## Preservation and cleanup

All 21 tracked final jobs are terminal. The two deliberately failing original-source replays exit 1; the other 19 exit 0. All 1,301 built files are copied into `built/` and verified by SHA-256. Six target dependency inventories and one Facebook fixture inventory are preserved and hashed before their exact owned originals are removed. The exact temporary build root and owned browser scratch directories are removed after jobs finish and preservation checks pass. No commit, push or deployment was performed.

Revalidate from the repository root:

```sh
python3 artifacts/live-context-owner-2026-10-06/verify.py
```

The broad goal remains active. Native chooser/context-notification overlap and optional notification failure isolation remain candidates for separate reproduction. The earlier live-retirement backend protocol still requires backend/Devvit deployment before releasing those previously changed clients; this pass does not deploy.
