# Avoid publishing unchanged single-player drafts — 4 October 2026

In the actual local single-player app, 32 rejected inputs left the answer empty but caused 32 defensive save copies and 64 ready-component render calls under development Strict Mode. A minimized single rejected event caused one copy and two render calls. The original production fixture also copied and rendered 32 times for each sequence of 32 rejected text edits, empty Backspaces, active-slot reselections, identical final-letter replacements and empty hinted deletions.

The local authority now returns without publishing when normalized editable letters and cursor are unchanged. It compares after stripping projected hint letters, preserving the distinction between immutable hints and the authority-owned draft. Selecting the already active slot also returns after the existing admission checks. Real text, deletion and cursor changes still publish fresh defensive snapshots; valuable transitions and the public save-copy behavior are unchanged.

This removes repeated observer notifications, JSON-based save copies and ready-view render calls for edits that leave the draft unchanged. It adds no cache, shared mutable snapshot, deferred edit, timer, listener or save batching. Input validation and normalization still run; the measured counts do not establish frame time, paint cost, production latency or FPS.

## Verification

Artifacts are in `artifacts/playable-unchanged-input-2026-10-04`, including captured originals, failing unit/browser loops, minimized reproduction, original production comparisons, owned source diff, Firefox proof and an asserted summary.

| Check | Result |
| --- | --- |
| Original authority observer test | Four unchanged editing operations notify four times, expected zero |
| Original single rejected event | One save copy and two component calls in development Strict Mode |
| Original 32 rejected events | 32 save copies and 64 component calls in development Strict Mode |
| Original production, each of five unchanged-edit cases | 32 save copies and 32 component calls |
| Updated actual app, each unchanged-edit case | Zero save copies and zero component calls; answer, cursor and material-save count preserved |
| New actual-app matrix | 330 assertions across 30 journeys |
| Matrix scope | Development/production React with Strict Mode wrappers; 390×568, 390×844 and 1280×844; 32 separate animation-frame opportunities per case |
| Existing focus behavior | 462 assertions pass |
| Existing bounded long input | 324 assertions pass |
| Existing answer capacity | 330 assertions pass |
| Existing composition delivery | 1,080 assertions pass |
| Existing rapid editing | 768 assertions pass |
| Existing immediate live submission | 306 assertions pass |
| Existing local IME boundary | 336 assertions pass |
| Existing race IME/dialog | 348 assertions pass |
| Existing cancelled native keys | 396 assertions pass |
| Total injected browser assertions | 4,680 pass |
| Portal units | 2,724 pass across 296 suites; 121 optional browser cases skipped in unit mode |
| Built-game journeys | 37 pass across seven hosted, Reddit, profile, economy, YouTube and candidate suites |
| Types and TSDoc | Pass; 25,165 documented declarations across 1,138 files |
| Builds and isolation audits | Jest, Facebook, Reddit, YouTube, Netflix and Yahoo pass |
| Source consistency | Runtime inputs unchanged throughout verification; final complete 765-path inventory stable after documentation repair |

The fixture mounts the actual `YouTubePlayableApp`, subscription hook and authority. Its private Vite transformation counts `cloneYouTubeSave` calls and ready-component function invocations without replacing their behavior. No instrumentation entered any of the six target artifacts, verified by scanning their JavaScript. The 32 unchanged events run with separate animation-frame opportunities; ordinary committed input, deletion, selection and hinted editing exercise the real handlers. Each journey also verifies a subsequent genuine edit, fresh defensive snapshot publication and one explicit native Enter win. `test:playable-unchanged-input:browser` registers both React modes in the game browser chain.

The two new authority tests check notification suppression, unchanged full answers, cursor changes, normalized hinted drafts and defensive save isolation against caller mutation. Existing pending-save, pause, rollback, serialization, replay and material-transition tests passed. The first TSDoc run found two undocumented cleanup handles in those new tests; adding their comments was the only source change after verification began. Removing those exact comments reproduces the initial test hash, and all other input hashes are unchanged. The final TSDoc audit passed.

## Firefox MCP

At 390×568, native rejected text `!? 123`, three empty Backspaces and clicking the active slot produced zero copies or ready-component calls, with an empty answer, one start save and an empty consumed input. Clicking a different slot produced one copy and one render call. Returning to the first slot and typing `rome` produced the correct answer and fresh snapshots without a material save. Typing the already present final `e` produced zero additional copies or render calls. Native Enter won once with one additional material save and no browser error or unhandled rejection.

`firefox-mcp-proof.json` retains seven raw and parsed observations, asserted before marking verification successful. Selection, typing, Backspace and Enter used native MCP controls; only fixture counter resets were injected. Counts are instrumentation observations, not production latency or mobile OS keyboard certification. The owned tab and fixture were closed; the original blank tab remained open.

## Scope and review

The equality check includes both normalized letters and cursor, so a visible cursor-only change cannot be lost. Its position after existing normalization preserves hint validation and rejection behavior. Slot reselection still runs the view's existing native-focus helper; suppressing a state publication does not prevent focusing the editor. Material mutations still emit and receive defensive copies, while unchanged input cannot create saves or discard pending state.

The improvement applies to the shared YouTube/Netflix/Yahoo local authority. No visible copy, locale key, provider SDK, persistent save schema, economy authority or multiplayer protocol changed. The unrelated authentication test-size limitation recorded in an earlier pass was preserved and not rechecked here. No commit, push, deployment or publication occurred. The broader reliability, performance, playability and latency goal remains active.
