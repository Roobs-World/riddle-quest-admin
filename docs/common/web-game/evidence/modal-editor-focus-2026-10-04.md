# Modal updates preserve the native editor and selected control

The username editor briefly received autofocus, then the modal shell's deferred frame moved focus to Close. Typing immediately after opening therefore missed the input. Game updates could also move focus away from the input or a selected Save/confirmation button. Covering and uncovering the modal restored Close instead of the editor.

`GameModalView` now keeps an eligible control that already has focus. Native focus capture remembers the last control so an uncovered modal can resume it, preserving the input node, draft and caret. Restoration checks the current modal or nested confirmation scope; removed, disabled and previous-page controls cannot reclaim focus. A retired, disconnected, inert or covered shell cannot accept its deferred callback. Closing clears the remembered control in the existing committed layout effect. Existing keyboard policy, mandatory locks, original game-trigger return and passive focus timing remain intact.

No visible copy, public props, provider calls, network traffic or economy authority changed. This improves continuity of input and keyboard play; no new network, hardware input-latency or frame-rate benchmark is claimed.

## Diagnosis and probes

The injected harness imports the actual modal, Profile and username form under StrictMode. Native Profile → Edit clicks expose the focus failure after two animation frames. The minimal command ran twice before repair:

```sh
cd packages/portal
MODAL_EDITOR_QUICK=1 MODAL_EDITOR_SMOKE=1 MODAL_EDITOR_SCENARIOS=open MODAL_EDITOR_BASELINE_DIR=../../artifacts/modal-editor-focus-2026-10-04 MODAL_EDITOR_REPORT_DIR=../../artifacts/modal-editor-focus-2026-10-04/minimal-repeat node scripts/verify-modal-editor-focus-browser.mjs
```

Both runs failed two of four observations: the input lost focus and immediate native typing produced no draft. Suppressing only the parent's deferred focus frame in the fixture passed all four. Firefox recorded input focus followed by Close focus, and confirmed that later updates retained the same input node and draft while stealing its focus.

Ranked hypotheses were shown before repair: the parent frame resets valid focus; the input never receives autofocus; or the update remounts the editor. Native focus history and DOM identity contradicted the latter two. Preserving only the eligible active control passed opening, input updates, selected Save and nested confirmation cases; the quick probe retained two failures among 60 observations, both caused by uncovering the editor. Remembering the last eligible native control passed all 61 observations. The final verifier then strengthened the caret check using native ArrowLeft and further typing at the middle of the draft, and added DOM identity checks.

The captured original fails 36 of 180 observations in that final verifier. The fixed source passes 192 per mode. Assertion counts differ because successful activation additionally checks that the submitted draft clears; the original's unfocused controls cannot perform those activations. The earlier full original run failed 30 of 171 observations. An initial partial run was interrupted when a bottom-positioned fixture toolbar intercepted a Profile pointer click; the toolbar was moved to the top before the full comparison. That partial diagnostic remains saved and is excluded from verification totals.

## Verification

| Evidence | Result |
| --- | --- |
| Editor focus, draft, caret and selected controls, both React modes | 384 assertions passed |
| Committed keyboard boundaries, both modes | 1,272 assertions passed |
| Canceled/composing/inert/detached keyboard admission, both modes | 744 assertions passed |
| Suspended Close callbacks and locks, both modes | 456 assertions passed |
| Full-game surface recovery, both modes | 824 assertions passed |
| Modal chains and compiled retained-modal journeys | 18 + six passed |
| Portal units | 2,756 tests across 297 suites passed |
| Rebuilt target browser journeys | 37 tests across seven suites passed |
| Types and TSDoc | Passed; 25,283 declarations across 1,139 files |
| Six builds and audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | 766 inputs and the owned verifier unchanged |

The new verifier covers seven scenarios across three viewports and two React modes: immediate typing on open; typing after an update at a middle caret position; selected Save retained through an update; editor restoration after cover/uncover; replacement-page focus; removed Shop-control fallback when dismissal readiness returns; and selected nested confirmation ownership plus nested/outer Escape. Native activation submits once, clears only the draft and never invokes account deletion. Fixture update buttons prevent mousedown focus movement to model external updates; final runs do not suppress animation frames. The verifier is registered as `test:modal-editor-focus:browser`, running both React modes, and included in `test:game-browser:playwright`.

Firefox independently verified initial editor autofocus without an extra input click, unchanged DOM identity/draft/caret after a game update, focus yielding to an inert cover and returning to the editor, selected Save surviving an update, single native Space submission, fresh native Enter submission after reopening, and original Profile-trigger focus after Escape. The native checks reported no browser errors, unhandled promises or delete calls.

Final JSON observation files contain 3,680 assertions with no failures. The 24 modal-chain/compiled journeys, Firefox observations and 37 built-game tests are tracked separately. Evidence, captured sources, owned diff, diagnostics, screenshots, native traces, React review and gate logs are in `artifacts/modal-editor-focus-2026-10-04`. Two owned serve-only fixtures and two owned Firefox tabs were closed; the existing blank tab remains. No changes were deployed. The broader game-improvement goal remains active.
