# Dialog keys respect editor and surface ownership

The normal game modal and failed-surface recovery dialog handled document Escape and Tab even when an earlier handler had canceled the event or a native composing flag identified an input-method event. A canceled Escape could close a username editor; canceled Tab could move focus despite the child's request to retain it. Both dialogs could also consume Escape after their DOM had been removed, before passive-effect cleanup completed. The normal modal additionally handled keys while an ancestor was inert.

The handlers now check `defaultPrevented`, `isComposing`, legacy composing `keyCode === 229`, connected dialog DOM, and inert ancestry before preventing a key, changing focus, or invoking Close. Existing committed callbacks, pending-action locks, focus setup, and native dismissal behavior are retained. No visible copy, public props, provider capabilities, or authority operations changed.

## Reproduction and diagnosis

The verifier imports the actual `GameModalView`, `GameSurfaceRecovery`, and username page, without substituting their implementations or modifying their hooks. A fixture capture handler can cancel a real native Escape/Tab to represent an earlier event owner. Composition cases inject explicit browser keyboard-event metadata. A native Retire button removes the component; a parent layout callback then dispatches Escape before passive cleanup. Cover/Uncover buttons apply inert ancestry while the component remains mounted.

The minimal command ran twice before repair:

```sh
cd packages/portal
MODAL_KEYS_QUICK=1 MODAL_KEYS_SMOKE=1 MODAL_KEYS_SCENARIOS=escape-cancelled MODAL_KEYS_SURFACES=modal MODAL_KEYS_REPORT_DIR=../../artifacts/modal-keyboard-admission-2026-10-04/minimal-repeat node scripts/verify-modal-keyboard-admission-browser.mjs
```

Both runs recorded four checks and one failed assertion: the real native event was canceled, yet Close was called once. The repeated minimal run omitted draft entry, confirming that the draft was not needed for the failure. Removing the capture consumer passed all three unclaimed-key control checks. The full original run recorded 372 assertions with 75 failures.

Ranked hypotheses were shown before repair:

1. Document listeners lack event and DOM ownership checks. The corresponding guard should eliminate only its class of failures.
2. The fixture does not cancel the native event correctly. Native `defaultPrevented` would remain false.
3. Another handler independently closes the modal. Guarding the document listener would leave the failure intact.

Firefox recorded `defaultPrevented: true` on a real input-targeted Escape but still observed a Close call. It also recorded a canceled native Tab from the username Save button followed by an unexpected focus move to Close. This ruled against the second hypothesis.

Probes changed one admission category at a time. The cancellation-only guard passed all 34 quick consumed-key checks, leaving 21 failures among 90 other checks. Adding the composition flags left five failures, all in inert/removed-dialog cases. Connected/inert checks then cleared the complete regression set. These results support the first hypothesis over the third.

## Verification

| Evidence | Result |
| --- | --- |
| Keyboard admission, development React | 372 assertions, zero failures |
| Keyboard admission, production React | 372 assertions, zero failures |
| Committed dialog callbacks/locks, both React modes | 456 assertions, zero failures |
| Full-game surface recovery, both React modes | 824 assertions, zero failures |
| Modal focus-chain journeys | 18 passed |
| Compiled retained/blocked profile and settings journeys | Six passed |
| Portal unit suite | 2,756 tests in 297 suites passed |
| Built-game browser suite | 37 tests in seven suites passed |
| Types and TSDoc | Passed; 25,276 declarations across 1,139 files |
| Six target builds and artifact audits | Jest, Facebook, Reddit, YouTube fixture, Netflix, Yahoo passed |
| Source inventory | All 766 inputs unchanged during verification |

The new harness covers canceled Escape/Tab; composing Escape/Tab with `isComposing` and legacy key code; inert dialog behavior; removal during parent layout; draft retention; fresh native username submission; ordinary Escape; and forward/reverse Tab loops. Both actual components run under StrictMode at 390×568, 390×844, and 1280×844. The command is registered as `test:modal-keyboard-admission:browser` and in `test:game-browser:playwright`, with both React modes.

The full-game regression retains failed-download/render recovery, offline ownership, paid Continue/Skip/Hint authority, and terminal navigation. The compiled retained-modal verifier exercises profile delete confirmation and blocked profile/settings surfaces. Together the recorded observation files contain 2,024 browser assertions; the additional 24 focus/compiled-modal journeys, Firefox traces, and built-game tests are reported separately.

Fixed Firefox native journeys confirmed that canceled Escape retained the Rival draft without calling Close; canceled Tab retained focus on Save; fresh Enter submitted Rival once and cleared the editor; fresh Escape called Close once. Explicit composing keyboard metadata stayed uncanceled and did not dismiss the modal; an ordinary subsequent Escape worked. Removing recovery through the native Retire button left the parent layout Escape uncanceled and produced no Close call.

Composition coverage simulates browser event metadata and does not establish compatibility with every operating-system IME. The injected event-consumer fixture represents an earlier child/provider handler; it is not a new production control. This pass establishes keyboard ownership behavior, not a new network-latency or hardware-performance benchmark.

Evidence lives in `artifacts/modal-keyboard-admission-2026-10-04`: before/after sources and owned diff, original/probe/final observations, screenshots, validated Firefox traces, gate/build logs, source inventories, React review, and verification summary. Only this pass's two Firefox tabs and two fixture servers were closed; the existing blank tab remains. Owned verifier processes and scratch directories were removed.

The broader improvement goal remains active.
