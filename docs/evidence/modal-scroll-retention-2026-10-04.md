# Dialog updates retain the player's reading position

Settings and Credits could jump to the top when game readiness changed. The shell's passive effect reset scroll on page changes, rewards, pending guesses, continuation readiness and uncovering. Profile has its own inner scroller: uncovering restored a selected bottom button with ordinary browser focus, scrolling the reader back to that button.

`GameModalView` now resets shell and backdrop scroll in a separate passive effect driven only by modal-page identity. Same-page updates retain the reading position. Restoring a remembered eligible control uses `preventScroll`; fallback focus for a new page retains ordinary behavior. Existing committed keyboard locks, callback publication, native caret preservation, nested confirmation scope and game-trigger return remain unchanged. No visible copy, public props, providers, SDKs, network calls or economy authority changed.

## Reproduction and diagnosis

The harness imports actual modal pages under StrictMode and uses native clicks, wheel scrolling and keys. The first fixture attempt was obstructed by its toolbar. After making that toolbar compact, the initial Profile-shell probe revealed that Profile actually scrolls an inner `.profile-page`; the shell has no scroll range. These diagnostics are retained and excluded from bug/verification totals. A later full comparison included a taller Settings viewport with no scroll range; final comparisons use three compact viewports where actual content exceeds the selected scroller. No artificial content or product CSS forces overflow.

The minimized Settings command ran twice:

```sh
cd packages/portal
MODAL_SCROLL_QUICK=1 MODAL_SCROLL_SMOKE=1 MODAL_SCROLL_SCENARIOS=settings-guess MODAL_SCROLL_BASELINE_DIR=../../artifacts/modal-scroll-retention-2026-10-04 MODAL_SCROLL_REPORT_DIR=../../artifacts/modal-scroll-retention-2026-10-04/minimal-settings-repeat node scripts/verify-modal-scroll-retention-browser.mjs
```

Both runs recorded six observations with one failure. Native wheel scrolling reached 109 pixels; a game update reset it to zero without changing the focused control or shell node. The no-update control passed all six. Firefox independently reproduced 176 → zero pixels in Settings, with unchanged focus and DOM identity.

Ranked hypotheses were shown before repair: readiness reruns the page-reset effect; the update remounts the dialog; or focus restoration scrolls the surface. DOM identity and focus contradicted the second and third explanations for Settings. Separating page reset passed the Settings and Credits cases, leaving one failed assertion among 80 observations: a covered Profile returned from 531 to 711 pixels when focus resumed on its bottom Delete button. Firefox reproduced 543 → 763 pixels with the same page and button. Restoring that eligible button without scrolling cleared the remaining failure. The quick combined probe passed 91 observations, including repeated-update work measurement.

The final captured original records 309 observations and 15 failures. Fixed development and production React each pass all 309. Final page-transition coverage includes leaving both a scrolled inner Profile and a scrolled Credits shell; Instructions starts at its own reading origin in both cases.

## Verification

| Evidence | Result |
| --- | --- |
| Native reading-position/scroll-work verifier, both modes | 618 assertions passed |
| Editor autofocus, draft, middle caret and selected controls, both modes | 384 assertions passed |
| Committed keyboard boundaries, both modes | 1,272 assertions passed |
| Canceled/composing/inert/detached key admission, both modes | 744 assertions passed |
| Suspended Close callbacks and locks, both modes | 456 assertions passed |
| Full-game surface recovery, both modes | 824 assertions passed |
| Modal-chain and compiled retained-modal journeys | 18 + six passed |
| Portal units | 2,756 tests across 297 suites passed |
| Rebuilt target browser journeys and native Help touch scroll | 38 tests across eight suites passed |
| Types and TSDoc | Passed; 25,284 declarations across 1,139 files |
| Six isolated builds and audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | 766 inputs unchanged; owned verifier snapshot matches |

The new verifier covers ten scenarios at 320 × 400, 390 × 400 and 1280 × 400, in both React modes: Profile guess/reward/continuation updates; selected Profile control cover/uncover; Profile → Instructions; Settings updates and 32 repeated readiness changes; Credits updates and Credits → Instructions; and inner Instructions updates. It checks real overflow, native reading position, surviving DOM/focus, page-reset origins, Escape return, single close, absence of account deletion, errors and unhandled promises. Fixture update buttons prevent mousedown focus movement to represent external updates. The fixture's observational `scrollTo` wrapper forwards the native implementation and records shell/backdrop calls; it does not alter component hooks or scrolling behavior.

Across 32 native readiness-update clicks, the original made 32 shell plus 32 backdrop reset calls at each viewport. The repair made zero in both React modes and retained the reading position. This measures reduced native scroll work and improved reading continuity, not network latency, hardware input latency or frame rate. The verifier is registered as `test:modal-scroll-retention:browser`, runs both React modes and belongs to `test:game-browser:playwright`.

Firefox independently verified native PageDown/PageUp scrolling, unchanged Settings position on update, unchanged Profile position and selected bottom control after cover/uncover, replacement-page origin/focus, and original Profile-trigger return after Escape. Firefox reported an actual 500 × 326 viewport, recorded in its evidence; the requested smaller window was constrained by the browser. No native check activated deletion or reported errors/unhandled promises.

Final JSON observations contain 4,298 passing assertions. The 24 modal-chain/compiled journeys, Firefox observations and 38 built-game tests are tracked separately. Sources, owned diff, diagnostics, screenshots, native traces, React review, build/gate logs and source inventories are in `artifacts/modal-scroll-retention-2026-10-04`. Both owned serve-only fixtures and both owned Firefox tabs were closed; the existing blank tab remains. No changes were deployed. The broader improvement goal remains active.
