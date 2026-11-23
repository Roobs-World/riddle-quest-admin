# Continue physical typing after single-player actions — 4 October 2026

In the actual shared local single-player game, clicking Hint and physically typing `ome` left only the revealed `r`, rather than `rome`. Focus remained on the Hint button. The captured original app also ignored physical typing after toolbar Submit, a shortcut-key click and paid Continue. A control restoring only native input focus made the original hint journey win, distinguishing focus ownership from input validation or hint locks.

User-invoked Hint, Submit and shortcut-key/deletion actions now return focus synchronously to the native answer editor. The existing slot-selection focus behavior uses the same helper. The ready-session effect focuses an answer when it becomes usable after starting, resuming, buying Continue or recovering a blocked save. Its derived editable flag excludes pause, blocked saving, awaiting Continue and result screens. An ordinary delayed receipt leaves an already editable answer's focus alone, preserving subsequent Tab navigation.

This changes the shared YouTube/Netflix/Yahoo local editor. It adds no listener, timer, promise callback, focus request state or authority transition. Focus from explicit editing actions occurs before the material operation; a save receipt cannot later take focus back from a control the player selected while waiting. Provider lifecycle, durable saving, hint locks, currency and scoring retain their existing rules.

## Verification

Artifacts are in `artifacts/playable-action-focus-2026-10-04`, including captured originals, failing observations, the positive control, the owned source diff, Firefox proof and an asserted verification summary.

| Check | Result |
| --- | --- |
| Original Hint → physical `ome` | `r`, expected `rome`; repeated failure |
| Original Hint with only input focus restored | `rome`, followed by one win |
| Original toolbar wrong submission → physical `rome` | Empty draft, expected `rome` |
| Original shortcut `R` → physical `ome` | `r`, expected `rome` |
| Original paid Continue → physical `rome` | Empty draft, expected `rome` |
| New actual-app matrix | 462 assertions across 54 journeys |
| Matrix scope | Development/production React with Strict Mode wrappers; 390×568, 390×844 and 1280×844 |
| New scenarios | Hint, keyboard-activated Hint, wrong toolbar submission, shortcut typing/deletion, paid Continue, held-save Tab navigation, pause/resume and failed-save retry |
| Existing bounded long input | 324 assertions pass |
| Existing answer capacity | 330 assertions pass |
| Existing composition delivery | 1,080 assertions pass |
| Existing rapid editing | 768 assertions pass |
| Existing immediate live submission | 306 assertions pass |
| Existing local IME boundary | 336 assertions pass |
| Existing race IME/dialog | 348 assertions pass |
| Existing cancelled native keys | 396 assertions pass |
| Total injected browser assertions | 4,350 pass |
| Portal units | 2,722 pass across 296 suites; 121 optional browser cases skipped in unit mode |
| Built-game journeys | 37 pass across seven hosted, Reddit, profile, economy, YouTube and candidate suites |
| Types and TSDoc | Pass; 25,158 documented declarations across 1,138 files |
| Final builds and isolation audits | Jest, Facebook, Reddit, YouTube, Netflix and Yahoo pass |
| Final source stability | Complete 765-path input inventory and hashes unchanged throughout final verification |

The new fixture mounts the actual `YouTubePlayableApp` and its authority. It uses real browser clicks and physical key delivery without programmatic refocusing between the action under test and typing. It checks the resulting answer and focus, retained hint locks, absence of typing-triggered material saves, empty consumed native text while the editor remains mounted, and one explicit final win. SDK controls hold/reject a save or emit pause/resume; they do not replace editing or authority behavior. `test:playable-action-focus:browser` registers both modes in the existing game browser chain.

Initial expanded runs exposed fixture issues: shortcut buttons are inside an existing `aria-hidden` keyboard, so its clicks require DOM locators; pause observations must wait for the React DOM update; and the authority intentionally retains busy state until resume, so the paused branch must resume before awaiting full settlement. These failures are retained. The final checks use the real lifecycle ordering and do not change those production rules. The final consumed-input assertion reads the still-mounted editor before submission.

## Firefox MCP

At 390×568, native Classic selection and Hint left the answer input focused with the revealed `r`. Native typing `ome` with no input UID or refocus produced `rome` without another save. Native Enter produced one win, one result and one additional save. On a fresh game, native typing `zzzz` and clicking Submit recorded one wrong guess and retained input focus; native `rome` then Enter won once.

In a third game, an injected SDK control held the Hint save. Native Hint focused input while the game remained busy. Native Shift+Tab moved to an answer tile. Releasing the held save preserved that exact focus owner and completed saving, with no page error or unhandled rejection. `firefox-mcp-proof.json` retains nine raw and parsed observations asserted before verification was marked successful.

Game selection, Hint, Submit, typing, Enter and Shift+Tab used native Firefox MCP. Only holding/releasing saving was injected. These checks do not certify mobile OS keyboard behavior or production latency. All three owned tabs and their fixture were closed; the original blank tab remained open.

## Related test compatibility and review

The first portal unit run exposed three failures in the existing race layout test double: it lacked `querySelector`, which the current layout hook uses to observe an optional scoreboard. The double now models that lookup. An added test confirms that a present scoreboard is observed and that a wrap moving the viewport origin from 100 to 140 pixels reduces the available height from 380 to 340 pixels. The multiplayer layout implementation was preserved. This test change accounts for the additional portal unit.

React review keeps interaction-driven focus in event handlers and lifecycle-driven focus on a derived primitive dependency. Already editable save projections do not retrigger the effect; disabled/inert editors are excluded. Existing IME, cancellation, composition, rapid-input and live submission checks passed. No visible copy, locale key, SDK, save schema, economy authority or multiplayer protocol changed. The unrelated authentication test-size limitation recorded in an earlier pass was preserved and not rechecked here. No commit, push, deployment or publication occurred. The broader reliability, performance, playability and latency goal remains active.
