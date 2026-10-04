# Prepare fixed keyboard letters once — 4 October 2026

The shared hosted single-player/multiplayer keyboard segmented its three fixed Latin rows on every render. The self-contained single-player keyboard split its fixed 26-letter shortcut string on each ready-view render. During 32 actual production typing transitions, the original shared keyboards made 96 fixed-row segmentation calls; the self-contained keyboard made 32 fixed-string split calls.

Both letter lists are now prepared once at module initialization. The shared rows retain their original row IDs and letter order. Feedback classes, disabled states and click callbacks still derive from current props on every render; only the fixed letter lists are cached. The shared controls also no longer require a runtime grapheme import for these ASCII literals.

## Verification

Artifacts, captured originals, minimized failures, the production before/after comparison, source diff, raw Firefox observations and an asserted summary are in `artifacts/static-keyboard-work-2026-10-04`.

| Check | Original | Updated |
| --- | --- | --- |
| Hosted single-player, 32 typing transitions | 96 fixed-row segmentation calls | 0 |
| Multiplayer, 32 typing transitions | 96 fixed-row segmentation calls | 0 |
| Self-contained single-player, 32 typing transitions | 32 fixed-string split calls | 0 |
| Hosted single-player, 32 parent updates | 96 segmentation calls | 0 |
| Multiplayer parent-update fixture | 192 segmentation calls | 0 |
| Self-contained single-player, 32 parent updates | 32 split calls | 0 |
| Confirmed keyboard feedback | Z becomes and remains red | Same |
| Key order and existing DOM identity | Preserved | Preserved |

A minimized development reproduction made six fixed-row segmentation calls for one hosted parent update, with no answer edit or multiplayer polling. One self-contained parent update made two fixed-string splits. This distinguishes repeated rendering work from answer-grapheme processing and transport polling. The original production survey bypassed only the zero-work assertion and passed every behavior assertion; its deliberately nonzero work is retained in the observations. The comparison covers the identical final scenarios and viewports using captured original component sources.

| Final gate | Result |
| --- | --- |
| New actual-game matrix | 708 assertions across 66 journeys |
| Matrix scope | Hosted single-player, live multiplayer and self-contained single-player; development/production React with Strict Mode wrappers; 390×568, 390×844 and 1280×844 |
| New cases | Physical typing/deletion, parent updates, shortcut clicks, and confirmed feedback on shared keyboards |
| Existing keyboard/IME lifetime | 376 assertions pass |
| Existing bounded input work | 324 assertions pass |
| Existing multiplayer action focus | 684 assertions pass |
| Existing single-player action focus | 462 assertions pass |
| Total injected browser assertions | 2,554 pass |
| Portal units | 2,724 pass across 296 suites; 121 optional browser cases skipped in unit mode |
| Built-game journeys | 37 pass across seven hosted, Reddit, profile, economy, YouTube and candidate suites |
| Types and TSDoc | Pass; 25,167 documented declarations across 1,138 files |
| Target builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo pass |
| Source stability | Recollected 765-path source/build-input inventory and hashes match before/after verification |

The new `test:static-keyboard-work:browser` command runs both React modes in the existing game browser chain. It renders actual `PlayHostApp`, `LiveRaceGame` and `YouTubePlayableApp` surfaces. Transparent fixture wrappers count only segmentation/splitting of the exact fixed keyboard strings and delegate other calls unchanged. Tests verify key order, retained DOM identity, complete drafts, no editing-triggered guesses, dynamic confirmed feedback, one explicit answer submission and the corresponding hosted completion, multiplayer advancement or local win.

## Firefox MCP

At 390×568, native P selection and `iano` typing completed the hosted draft with no guess and zero repeated fixed-letter calls; native Submit produced one guess and one hosted completion. Native slot selection and `piano` typing in multiplayer likewise made zero repeated fixed-letter calls; native Enter sent one guess and advanced to 1/10. Native Classic selection and `rome` typing in the self-contained app preserved the start save count at one and made zero repeated fixed-letter calls; native Enter produced one win and a second save. The unchanged letter order and absence of browser errors were checked on all three surfaces.

Six raw and parsed observations were asserted before the proof was marked verified. All three owned tabs and the owned fixture were closed; the original blank tab remained open. Services, SDK and method counters were injected; selection, typing and submission used native Firefox controls.

## Scope and next audit

These measurements count avoided fixed-letter preparation after initialization. Answer segmentation, React rendering and per-key feedback evaluation still perform their required work. No frame-rate, full input-latency, battery or production network claim is made.

The original multiplayer parent-update fixture performed more renders than the other surfaces and supplies a new close callback on each update. Callback identity and delivery-effect lifetime are a separate follow-up to reproduce; this pass changes only fixed letter preparation.

React review keeps the static arrays at module scope without useMemo, new effects, state or subscriptions, and leaves dynamic JSX generation in place. No visible copy, locale keys, provider SDK, persistence, economy authority or transport behavior changed. No commit, push, deployment or publication occurred. The broader reliability, performance, playability and latency goal remains active.
