# Facebook multiplayer controls — 28 November 2026

The owner requested removal of the separate **Play on Facebook** control and Facebook tournaments. Facebook multiplayer now uses the existing **Play with friends** (`context.chooseAsync`) and **Find opponent** (`matchPlayerAsync`) flows. Conditional **Return to solo play** and **Join room game** controls share the same action row.

The native disclosure, duplicate no-argument friend picker, discovery counts, dedicated Refresh button, native tournament list, Tournaments tab, group-tournament controls and tournament-dependent session-score controls are removed. Discovery runs when the multiplayer surface mounts. Cancellation, duplicate-click protection, context reconciliation and unmount retirement remain in the Facebook adapter. Activity and live-result context standings remain available. Retired tournament entry envelopes return to ordinary play without accepting nested challenge data.

All 14 unused translation keys were removed from each of the 16 locales. The generic shared action slot contains no Facebook SDK imports; other providers retain their capability-controlled tournament board. Facebook no longer composes the retained tournament/session-score adapters. The revised API checklist therefore classifies 12 entry points as deliberately excluded: **51 W, 10 C, 6 G and 12 X** across the historical 79-entry inventory. These classifications are not provider acceptance.

The protected Firebase/configuration/provider-server baseline is unchanged. No Firebase build, deployment or configuration mutation is part of this change. Production promotion and review submission remain separate.

## Verification

- 33 focused native-social/entry-codec tests passed across three suites.
- TypeScript, all-locale audit and diff checks passed.
- Independent production-code review found no actionable issue.
- The focused built-entry multiplayer browser journey passed in 17.46 seconds; the full integrated browser regression passed in 38.96 seconds after adding forbidden tournament-endpoint sentinels. Checks cover the integrated row, duplicate-click suppression, cancellation/tab retirement, room/solo outcomes, canonical chooser recovery, legacy entries with the retained backend tournament flag on/off, and independent context scoring. These use an isolated SDK fixture, not a real Facebook account.
- The built artifact audit passed: 421 files, 4.47 MB total, 0.58 MB initial, without Jest gaming SDK, native-module or secret leakage.
- [Testing version 24](facebook-testing-version-24-2026-11-28.json) was uploaded once and assigned after all 421 provider-served runtime files matched the immutable ZIP. Production, Firebase and Vercel were unchanged.

## Actual Facebook desktop check

The [structured Chrome record](facebook-chrome-multiplayer-version-24-2026-11-28.json) binds the checks to exact **version 24 / bundle 29078291508509160 / SDK 8.0 WEB**. At 09:35–09:40 UTC, the page displayed only Play and Activity, with the existing friend/opponent controls and no separate disclosure or tournament controls. Activity’s Play with friends opened the native Facebook chooser. Closing it without selecting anyone or sending restored both buttons, with no error notice or paused root.

The game preserved **1,440 coins** and the winter hand-covering clue. Normal game Quit reached Facebook Gaming; a fresh exact-version launch restored the same state without Retry. The fresh launch and multiplayer opening had no `.play-alert`, `.game-notice` or `.race-error`, and a full viewport screenshot showed the clean revised page. Final game Quit at **09:40:23.769 UTC** reached `/gaming/play/` with no game iframe. The owned tab was closed and preexisting tabs preserved. No phone was used.

The first cropped image showed a generic error banner; a later cropped image was byte-identical despite contemporaneous DOM reads finding none. The fresh targeted checks and full viewport capture did not reproduce it. Its origin remains unconfirmed, so this is not evidence of a fixed game error or a universal error-free session. Room/solo controls were absent for this solo context; real room/group outcomes, social delivery and the wider submission matrix remain outside this check.
