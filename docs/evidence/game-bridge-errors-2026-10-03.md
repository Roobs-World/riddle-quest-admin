# Game bridge error recovery and listener ownership — 3 October 2026

The game listener previously observed asynchronous router failures with a handler that survived listener cleanup. A rejection after router replacement, host-sender replacement, or unmount still emitted an error reply and telemetry through the retired listener. Synchronous routing exceptions escaped the event handler. A throwing optional telemetry adapter prevented the original error reply; rejected telemetry delivery and a throwing host sender caused uncaught browser errors.

## Reproduction and implementation

The injected browser fixture mounts the actual `useGameMessageListener` under React StrictMode and independently controls router delivery, host sender, and the target-owned browser error adapter. It exercises both local bridge custom events and native message events. The preserved hook baseline SHA-256 is `2c03fd21c0e86c227c2dd91b8b6e616121d1aeaed3cd8818e91c995e3fc2e63b`; the browser reporter baseline is `62db0a4662083e10d8b436e2f05faf5f0a6dae58e4e50d6db420dd60dea36369`. Their recorded run produced 30 mismatches among 64 desktop/phone observations, including seven uncaught failures per viewport.

The listener now retires pending error replies before removing its two subscriptions. It checks ownership before reporting and again after telemetry, since that callback may synchronously close the game. Routing still starts synchronously, with no extra scheduling delay; both synchronous exceptions and rejected router promises enter the same error-recovery path. A failed error reply is reported once without recursively using the same failing transport. Same-origin and parent-source checks remain in place, and current failures retain their request prefixes and existing translated fallback.

The shared target-owned reporter now consumes synchronous adapter failures and observes asynchronous reporting rejection. Callers continue recovering immediately. No new SDK, remote telemetry target, visible product copy, grant, server authority, or target boundary was introduced.

## Verification

Evidence is in `artifacts/game-bridge-errors-2026-10-03/`:

- The final fixture passes 64 observations with development StrictMode and 64 with production React, at 1280 and 390 pixels. It covers origin/source rejection, one immediate dispatch per event, current error delivery and telemetry, independent router/sender retirement, ordinary profile updates, synchronous exceptions, translated non-Error rejection, synchronous/asynchronous telemetry failure, host-sender failure and recovery, both late failures after unmount, subscription removal, and telemetry-triggered unmount. There are no uncaught browser errors.
- Four reporter unit tests pass, including late asynchronous adapter rejection and recovery after a throwing adapter. The complete portal suite passes 278 suites and 2,401 tests; 118 opt-in tests are skipped. An initial run caught another chat's provider-view test mid-edit; the corrected test was reread and the complete suite rerun successfully without changes to that chat's work.
- The readiness harness passes in both React runtimes at desktop and phone widths. The existing single-player browser recovery harness passes at both widths, covering replay, completion acknowledgment, startup reconnect, profile delivery, account retirement, editing, and unmount.
- The complete hosted production Jest game journey passes against the existing built artifact on a dedicated local port. It exercises onboarding, navigation, Classic/Daily gameplay, rewards, purchase/profile flows, responsive layouts, and accessibility. Held-response input feedback remains immediate in the fixture: 6.0 ms for the wrong-answer observation and 4.5 ms for the correct-answer observation. These are controlled fixture measurements, not production network measurements or a claimed speedup from this error-handling change. Saved gameplay screenshots were inspected.
- Workspace types, TSDoc, source-size, script-syntax, and scoped whitespace checks pass. TSDoc covers 23,974 declarations across 1,094 files; source-size audit covers 1,168 files.
- All six production target builds and their artifact-isolation audits pass. `build-results.json` records exits and durations. `final-source-match.json` confirms that both runtime modules, the unit tests, and the injected fixture match the recorded tested sources. The normal game-browser chain now includes both runtimes of the new fixture.

Browser verification used Chromium. Aggregate results describe the shared checkout, including concurrent changes from other chats. No commit or deployment was performed.

The goal remains active. The host-side lifecycle listener has a related candidate issue: asynchronous failures use the latest notice setter after the original account or listener has retired. Reproduce that separately while preserving its stable subscriptions and existing account-lease ownership model.
