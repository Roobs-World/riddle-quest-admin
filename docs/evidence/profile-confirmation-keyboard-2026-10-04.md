# Nested Profile confirmation respects keyboard ownership

The account confirmation's React key handler ignored an earlier handler's `preventDefault`. A real canceled Escape still dismissed the confirmation; canceled Tab could move its selected control. IME-marked Escape and Tab also caused dismissal/navigation despite the outer modal already yielding to those events.

`ProfileModalPage` now admits only Escape and Tab, then yields to `defaultPrevented`, native `isComposing`, and legacy `keyCode === 229` before cancellation, focus movement or dismissal. Ordinary Escape still closes only the confirmation and restores its Delete trigger; forward/reverse Tab still wraps within its enabled controls. Destructive activation, account APIs and callback behavior did not change. No visible copy, public props, locale keys, provider calls, network traffic or SDK dependencies changed.

## Diagnosis

The verifier imports actual `GameModalView`, registered Profile and the nested confirmation under StrictMode. A document capture listener claims a native key by preventing default while allowing propagation into React; it does not replace the component or hook. Synthetic DOM keyboard events separately exercise modern/legacy IME metadata. A button-only confirmation has no native text composition, so these are metadata admission checks rather than an operating-system IME session.

The minimized native Escape command ran twice before repair:

```sh
cd packages/portal
PROFILE_KEYS_QUICK=1 PROFILE_KEYS_SMOKE=1 PROFILE_KEYS_SCENARIOS=escape-cancelled PROFILE_KEYS_BASELINE_DIR=../../artifacts/profile-confirmation-keyboard-2026-10-04 PROFILE_KEYS_REPORT_DIR=../../artifacts/profile-confirmation-keyboard-2026-10-04/minimal-repeat node scripts/verify-profile-confirmation-keyboard-browser.mjs
```

Both runs failed two of seven observations: confirmation disappeared and selected focus changed after the canceled key. Removing the earlier key claim passed all six control observations and admitted ordinary Escape. The full captured original recorded 378 observations with 54 failures.

Ranked hypotheses were shown before repair: the nested handler ignores cancellation; the outer modal mishandles the key; or cancellation arrives after React. The outer Profile remained mounted and the capture trace showed default prevention before the nested handler. Firefox reproduced the canceled Escape with one claimed native event, no outer Close call and no deletion call.

A cancellation-only guard fixed every native canceled Escape, forward Tab and reverse Tab. Its quick run recorded 126 observations, retaining 14 failures exclusively in IME/legacy cases. Reading composition metadata from `event.nativeEvent` cleared the remaining failures; development and production React each passed 378 final observations.

The initial focus-eligibility investigation also verified that the hidden upload input is excluded from native Tab order. Firefox adds an ordinary Tab stop on the scrollable Profile body; an initial assumption that two Tabs reach Edit instead reached the avatar button. The subsequent native avatar → Edit transition skipped the file input as intended. This observation required no focus-selector change.

## Verification

| Evidence | Result |
| --- | --- |
| Nested confirmation key admission, both React modes | 756 assertions passed |
| Editor autofocus, draft, caret and selected controls, both modes | 384 assertions passed |
| Reading position, page transitions and scroll work, both modes | 618 assertions passed |
| Committed keyboard boundaries, both modes | 1,272 assertions passed |
| Outer/recovery canceled, composing, inert and detached key admission | 744 assertions passed |
| Suspended Close callbacks and locks, both modes | 456 assertions passed |
| Full-game surface recovery, both modes | 824 assertions passed |
| Modal chains and compiled retained-modal journeys | 18 + six passed |
| Portal units | 2,756 tests across 297 suites passed |
| Rebuilt target browser tests | 38 tests across eight suites passed |
| Types and TSDoc | Passed; 25,284 declarations across 1,139 files |
| Six isolated builds and audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | 766 inputs unchanged; owned verifier snapshot matches |

The new verifier runs nine scenarios across three viewports and both React modes: Escape, forward Tab and reverse Tab, each with an earlier native claim, modern composition metadata or legacy 229 metadata. After each ignored key it verifies fresh native forward/reverse wrapping, nested-only Escape, Delete-trigger return, outer Escape and game-trigger return. No scenario activates account deletion. Browser errors and unhandled promises remain empty. It is registered as `test:profile-confirmation-keyboard:browser`, runs both React modes and belongs to `test:game-browser:playwright`.

Firefox independently confirmed the original canceled native Escape and composition-metadata failures. With the repair it preserved the confirmation and selected Cancel button after the claimed key, wrapped both ordinary Tab directions, closed only the confirmation on fresh Escape, returned focus to its Delete trigger, and restored the game trigger on outer Escape. IME-marked Escape remained uncanceled without dismissal; a following ordinary Escape still worked. Native and metadata observations contained zero deletion calls, errors or unhandled promises.

Final JSON observation files contain 5,054 passing assertions. The 24 modal-chain/compiled journeys, Firefox observations and 38 rebuilt-game tests are tracked separately. Captured sources, owned diff, probes, observations, screenshots, native traces, React review, gate/build logs and source inventories are in `artifacts/profile-confirmation-keyboard-2026-10-04`. Both owned serve-only fixtures and both Firefox tabs were closed; the existing blank tab remains. No changes were deployed. The broader improvement goal remains active. No new latency or frame-rate benchmark is claimed in this pass.
