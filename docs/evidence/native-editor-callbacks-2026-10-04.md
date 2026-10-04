# Native editor callback ownership — 4 October 2026

Software-keyboard deletions now use the callbacks of the committed editor. Suspended or abandoned React renders cannot replace them, and events delivered to a detached editor cannot mutate an answer before passive cleanup completes. The fix applies to the shared hook used by the race editor and the local single-player playable editor.

## Reproduction and diagnosis

The injected browser mounts the actual `NativeAnswerInput` and `YouTubeNativeAnswerInput`. It starts a React transition from callback version A to B, renders the editor with B, then suspends an adjacent child before commit. The visible version remains A, the same input retains focus, and its native deletion listener stays installed. A native `beforeinput` deletion originally invoked B anyway.

```sh
pnpm_config_verify_deps_before_run=false NATIVE_CALLBACK_QUICK=1 \
  NATIVE_CALLBACK_REPORT_DIR=artifacts/native-editor-callbacks-2026-10-04/red \
  node packages/portal/scripts/verify-native-editor-callbacks-browser.mjs
```

The original minimized loop fails with actual `["B"]` instead of `["A"]`. The only required transition is an editor render that does not commit, followed by a native deletion event. Three hypotheses were ranked before controls: speculative render writes leak through the callback ref; B actually committed unnoticed; or StrictMode alone creates the behavior. Production reproduces the leak in both editors. DOM version and identity controls prove A remains visible. Physical Backspace uses A through React's committed event props, isolating the problem to the native listener's callback publication.

A second scenario removes the editor and dispatches a retained deletion from its parent's layout effect, before passive cleanup. The original listener still invokes a callback. Publishing only committed callbacks fixes the suspended, abandoned and composition scenarios, but leaves that retirement scenario failing with A. A disconnected-input guard fixes the remaining boundary.

## Change

`useNativeAnswerBackspace` publishes its deletion and edit-intent callbacks together in a layout effect. Initial refs still belong to the mounted editor. Its existing native subscription remains stable across ordinary renders, and the listener now also rejects events when its captured input is disconnected. Existing cancelled, disabled and composition guards remain intact.

The native-editor production change is confined to this shared hook. No visible text, provider SDK, operation IDs, scoring or economy behavior changed. The new browser regression is registered in the game browser verification chain.

## Verification

Original and updated production surveys have identical keys for all 450 assertions. The original fails 36 callback ownership and retirement assertions; all other controls pass. Updated development StrictMode and production pass all assertions. Eight scenarios cover commit, abandonment, disabled input, cancelled input, composition, ordinary callback updates, retirement and events delivered during retirement commit. Each mounted editor must own exactly one native deletion listener. Thirty-two parent updates keep its subscription counts unchanged.

| Check | Result |
| --- | --- |
| New browser coverage | 96 journeys / 900 assertions |
| Modes and viewports | Development StrictMode and production; 390×568, 390×844, 1280×844 |
| Composition delivery regressions | 1,080 assertions |
| Composition retirement regressions | 408 assertions |
| Navigation and delayed composition-tail regressions | 1,872 assertions |
| Total injected browser assertions | 4,260 |
| Portal units | 2,756 passed in 297 suites; 121 optional browser tests skipped |
| Current built game journeys | 37 passed in seven suites |
| Types and documentation | Passed; 25,248 declarations documented across 1,139 files |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix candidate and Yahoo candidate passed |
| Stable source inputs | Independently collected 766-path inventories and hashes match |

Native Firefox at 390×568 retained the focused version-A editor while B was suspended. Physical Backspace and an injected software-style `beforeinput` deletion each invoked A. After B committed, the next deletion invoked B exactly once, with the same focused input and the same native listener. Retirement emitted no additional deletion, including the commit-boundary event and retained-listener calls, and released the listener. The sequence passed for both actual editor components. Eight raw observations were parsed and asserted with no browser error or unhandled promise.

The owned Firefox tabs were closed, the original blank tab preserved, and the fixture stopped with its scratch directory removed. Captured originals, failed loops, staged callback-only control, exact source diff, production comparison, asserted Firefox proof and verification summary are under `artifacts/native-editor-callbacks-2026-10-04`.

The pass began by investigating a previous Firefox next-prompt focus observation. A fresh native Enter transition preserved focus in Chromium and Firefox, so that suspected focus issue remains unconfirmed. Its temporary fixture source and asserted fresh-transition control are retained separately under `artifacts/race-prompt-focus-2026-10-04`; no focus implementation was changed based on the weaker observation.

The callback tests use real React and native browser event dispatch in controlled fixtures. The software-style events are injected; no claim is made about a particular operating-system keyboard or live-provider latency. Final checkout revalidation also caught and fixed a retained-checkpoint draft regression; its separate evidence is in checkpoint-restore-admission-2026-10-04.md. All final global gates were rerun after that fix and the concurrent source changes. Thirty-six missing documentation comments were added without changing the concurrent code behavior. Historical failed and initial gate reports are retained alongside the final reports. The broader improvement goal remains active.
