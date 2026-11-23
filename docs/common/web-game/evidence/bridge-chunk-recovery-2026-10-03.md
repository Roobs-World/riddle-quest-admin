# Hosted game startup code recovery — 2026-10-03

A failed first download of the shared bridge validation module could leave hosted play waiting for initialization. Readiness messages continued every 750ms, and routing failures could expose a raw module URL in a transient notice. This affects the shared hosted startup path used by both solo and multiplayer entry points.

The host now distinguishes a failed validation-module import from invalid message data and ordinary command failures. A current authentication visit can show recovery once; queued rejections and later game messages cannot repeat that recovery. Existing ownership checks remain before and after diagnostics. The underlying failure is retained as `Error.cause` for the target-owned error adapter.

Recovery replaces the game frame, retiring its readiness interval and resize observation. It also calls the existing startup-unavailable callback so a provider loading surface can dismiss. The screen reuses `ErrorMessages.FATAL_STARTUP_TITLE`, `ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE`, `CommonAlerts.OFFLINE_MESSAGE`, and `CommonButtons.RETRY`, already translated in all 16 supported locales. Retry has a 48px minimum height, is disabled offline, excludes repeated same-turn clicks, and reloads only after an explicit player action. A thrown reload is reported safely and leaves the action retryable. Invalid envelopes and service failures retain their existing handling.

## Why a new document is needed

The production-browser diagnostic used the real lazy parser import and compared the original cached promise with a temporary variant that cleared the promise after rejection. In Chromium, both variants made one failed asset request. Restoring the asset and retrying within the same document still made no second request and did not execute a handler. Reloading after restoration made a second request and successfully executed the handler. Resetting a JavaScript promise alone therefore did not repair this observed native module-cache failure.

This is an observed Chromium result, not a claim about every browser or every possible import failure. Recovery does not automatically navigate or loop reloads after a persistent failure.

## Verification

- Actual `PlayHostApp`, session assembly, bridge routers, lazy schemas, recovery view and game frame: **164 browser assertions passed**, split equally between development Strict Mode and production React at 390px and 1280px.
- Saved pre-change routing, lifecycle and error-formatting modules: **18 assertions failed among 72 baseline checks**, reproducing the missing recovery, repeated readiness work and raw error notice. Component-only probes use the new recovery component in both variants; only the saved routing modules are replaced in the baseline build.
- Failure injection aborts the real validation asset. Checks cover one coalesced request, one host startup diagnostic, provider-loader dismissal, no readiness wakes over three seconds, no repeated diagnostics from later messages, offline suppression, persistent-failure retry, successful restoration, unchanged authoritative coins/progress, no paid/guess/purchase handler execution, ordinary malformed-message handling, repeated-click exclusion and denied-reload retry.
- **Firefox 157 production verification: 25 assertions passed** through Mozilla Firefox DevTools MCP. The server returned a real HTTP 503 for the validation asset; native UID clicks retried a persistent failure and then recovered after the asset was restored. The recovery screen fits both inspected viewport sizes, has a 48px Retry button, stops readiness work and reports once. Restored play displayed the riddle, retained 300 coins and seven completed games, emitted no fixture diagnostic and executed no paid handler. Firefox's failed-startup document issued one riddle load; these checks do not claim that all startup reads are prevented.
- Actual module-loading unit regressions passed: failed imports are classified and coalesced, preserve their cause and cannot dispatch queued commands; malformed messages and handler failures retain their own error identity.
- Bridge dispatch/notice ownership and host lifecycle ownership browser regressions passed in development and production.
- Full portal unit suite: **280 suites and 2,415 tests passed**; 118 opt-in browser tests were skipped by the unit invocation and the relevant hosted journeys ran separately.
- Production hosted Jest, Facebook and Reddit journeys passed.
- Workspace type checking, TSDoc and source-size checks passed. Seven missing comments in concurrently modified catalog files and the game frame were repaired without changing their behavior.
- **All six isolated target builds and their artifact audits passed:** Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. Target adapter, SDK, self-contained content and advertising boundaries remain enforced by those audits.

Firefox MCP became discoverable during this pass, but its configured process had no display environment and requested a visible Firefox window. A private backup was saved and `--headless` was added to its arguments in `/home/craig-beswetherick/.codex/config.toml`. The already-running app connection still used its original launch options. A fresh, isolated MCP stdio session using the same package and binary successfully launched headless Firefox without display variables and performed the verification above. That session, its temporary profile and the injected test server were closed. The app connection needs to reconnect to use the updated arguments.

## Sources and saved evidence

Changed game sources: `bridgeRouter.ts`, `useHostBridgeLifecycle.ts`, `hostMessageHandlers.ts`, `PlayHostApp.tsx`, new `BridgeStartupRecovery.tsx`, and its scoped rule in `styles.foundation.css`.

`packages/portal/scripts/verify-bridge-chunk-recovery-browser.mjs` is registered as `test:bridge-recovery:browser` in the normal game-browser chain and runs both React modes. Its optional serve-only mode supports external Firefox MCP verification; fixture failure controls are available only in that mode on the local test server. The server reads files before sending response headers, allowing missing Firefox favicon requests to return 404 safely.

Saved evidence is under `artifacts/bridge-chunk-recovery-2026-10-03/`: original-module snapshots and diffs, `diagnostic.json`, browser observations/screenshots, baseline observations, unit/type/audit/build logs, full target-journey logs, Firefox MCP request/response records, Firefox assertions, server response counters, and source fingerprints. Source fingerprints distinguish the later fixture-only changes from the unchanged tested game implementation. No changes were committed or deployed by this pass.
