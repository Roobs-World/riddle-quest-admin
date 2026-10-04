# Host bridge account ownership and provider lifecycle recovery — 3 October 2026

The host listener previously forwarded delayed router failures through the latest notice setter, even after the originating account, identity provider, or listener retired. A synchronous routing exception escaped the event handler. Retained provider callbacks could pause a replacement game after cleanup, while SDK registration or unsubscribe exceptions could unmount the game and leave subscriptions behind.

## Reproduction and change

The injected fixture mounts the actual `useHostBridgeLifecycle` and `useHostAuthSession` under development StrictMode or production React. Controlled adapter notifications change account identity before React commits, including a new account generation with the same UID and leaving then returning to the same UID. Provider adapters retain queued callbacks and independently fail pause/resume registration or cleanup. An error boundary records whether an effect failure unmounts the playable fixture.

The preserved original listener is `artifacts/host-bridge-ownership-2026-10-03/baseline-source.txt`, SHA-256 `1f974eca220bd635763e691dc713e0dc72538db97886a59c4c63ba59af710435`. The final fixture records 70 baseline mismatches among 116 desktop/phone observations. Registration failures remove the playable fixture; pause-unsubscribe failure skips resume cleanup. Old account failures, retired provider callbacks, and errors during telemetry also demonstrate incorrect ownership.

`PlayHostApp` now supplies the existing authentication visit guard to the host listener. Each dispatched message captures that guard and the current listener lifetime. Messages cannot enter an old account's router between its retirement notification and the replacement render. Late failures cannot produce notices or telemetry for another visit. The listener rechecks ownership after optional reporting, which can itself synchronously change account or unmount the host. Current errors still reach the latest notice setter through the existing translated formatter; synchronous exceptions use that same recovery path.

The bridge and visibility subscriptions remain stable through profile, router, sender, and notice-callback replacement. Message and lifecycle delivery still start synchronously. SDK callbacks check their effect lifetime, and each registration has an independent guard. If an SDK retains a callback before throwing during registration, that callback becomes inert. Pause and resume registration and cleanup failures are reported independently, allowing the other signal and browser visibility fallback to continue. Cleanup marks callbacks retired before removing DOM subscriptions or calling either unsubscribe. A throwing notice or lifecycle sender is reported without recursively attempting the failing delivery.

Repeated aggregate checks also exposed a missing optional-context guard in concurrently added Facebook code and four missing API-field comments. The context comparison now returns false when that optional SDK context is unavailable; the fields have documentation. The concurrent private-context feature was otherwise preserved.

No visible product copy, provider SDK, authority grant, economy operation, or target boundary was added.

## Verification

Evidence is in `artifacts/host-bridge-ownership-2026-10-03/`:

- All 116 injected observations pass with development StrictMode and another 116 with production React at 1280 and 390 pixels. They cover immediate single dispatch, stable subscriptions, profile-only updates, latest notice/sender callbacks, pre-render retirement, same-UID generation and visit replacement, sign-out, identity-provider replacement, lifecycle replacement, retired callbacks, current pause/resume and visibility handling, synchronous routing failure, failing optional telemetry, notice/sender failure, complete teardown, telemetry-triggered ownership changes, independent SDK registration/cleanup failure, and retained callbacks from failed SDK registrations. No uncaught browser or host-effect errors occur in the passing runs.
- The existing game-side bridge error fixture passes all 128 observations across both React runtimes. Single-player recovery passes at desktop and phone widths, including replay, startup/completion reconnect, profile delivery, account retirement, editing, and unmount.
- Complete hosted production Jest, Facebook SDK, and Reddit Devvit browser journeys pass. These exercise real target entries with injected authorities and provider APIs, including onboarding/authentication, progress, single-player and multiplayer flows, immediate feedback, provider lifecycle, restoration, and same-origin Reddit delivery. The Facebook harness also builds its own isolated 13+ artifact for capabilities under test. Saved hosted gameplay screenshots were inspected. Timings in the logs are controlled fixture observations, not measurements of production network latency or a claimed speedup from this ownership change.
- The complete portal unit suite passes 278 suites and 2,401 tests; 118 opt-in tests are skipped. All workspace type checks pass.
- All six production target builds and their isolation audits pass; `build-results.json` records exits/durations. `final-source-match.json` confirms that the listener, production caller, and injected fixture still match the recorded tested sources.
- TSDoc passes for 24,036 declarations across 1,095 files, and source-size audit passes for 1,169 files. Script syntax, command registration, and scoped whitespace checks pass. The normal game-browser command includes both runtimes of this host fixture.

An SDK that fails before returning its unsubscribe cannot be forced to release its internal callback. The per-registration guard prevents that retained callback from changing the game. Browser verification used Chromium. Aggregate checks describe the shared checkout, including concurrent work from other chats. No commit or deployment was performed.

The goal remains active. Next, inspect successful asynchronous router dispatch after account retirement: listener error ownership does not by itself cancel a router that has already started loading its parsers. Also check whether already-rendered host notices remain visible after a different account is selected.
