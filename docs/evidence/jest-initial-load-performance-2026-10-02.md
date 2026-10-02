# Jest initial load improvement — 2026-10-02

Jest now starts identity exchange alongside the optional social-profile lookup. Once authentication, App Check, and purchase recovery succeed, it starts the existing issued-riddle preloads while the mandatory server profile and translated namespaces load. The game still waits for authoritative progression before enabling state writes or mounting. The deletion operation gate covers preparation and checks again before committing.

Urgent incomplete purchases are reconciled before optional profile and identity work. Guest purchase recovery remains disabled. Purchase grants, completion ordering, account deletion, and SDK initialization use the existing adapters and server authority. No SDK signatures, visible copy, or Developer Console configuration changed.

## Repeatable startup measurements

Five fresh Chromium contexts per scenario, viewport 390 × 844, no browser cache. The harness imports the actual startup, session commit, locale loader, and deletion gate modules. It injects repeatable delays: signed player 80 ms, registered recovery lookup 80 ms, optional social profile 200 ms, identity exchange 220 ms, Firebase authentication 60 ms, mandatory profile 200 ms, issued content 320 ms, and each translated namespace response 80 ms. Urgent recovery adds 120 ms.

The baseline ran against a source snapshot taken before these scheduling changes and reproduced the previous serial app hydration call site. The after run used the updated snapshot with the same delays. Timing starts when the startup request path begins, after the harness module has loaded, and ends when content has arrived and readiness is reported. It excludes initial bundle and real Jest SDK downloads. These are controlled request-path measurements, not production time-to-play guarantees.

| Scenario | Before median | After median | Reduction |
| --- | ---: | ---: | ---: |
| Guest | 882.9 ms | 681.4 ms | 22.8% |
| Registered, English | 1163.9 ms | 761.4 ms | 34.6% |
| Registered, Turkish | 1582.3 ms | 854.1 ms | 46.0% |
| Registered, urgent purchase recovery | 1281.8 ms | 881.6 ms | 31.2% |

Raw event timelines and source hashes are in `artifacts/jest-initial-load/{before,after,source-before,source-after}.json`. The Jest artifact audit reports the same rounded initial resource size, 0.49 MB; this change removes serial waits rather than reducing the initial bundle.

## Validation

- 45 focused startup and commit unit tests passed. They cover pending social reads, independent translation/profile completion order, mandatory profile failure, cancellation, deletion, purchase recovery, SDK failures, and heartbeat behavior.
- 16 selected injected-SDK browser tests passed against the updated production Jest build: guest and registered startup, restored language on reload, short phone preview, delayed SDK request/handshake, background product catalog, four startup failure screens, transient retry, terminal account deletion, optional social failure, and the 25-second loading watchdog.
- The new controlled social-profile browser test verifies Firebase authentication finishes while the SDK social request is pending, readiness is withheld until playable UI, the starting balance remains 300, and no page errors occur. Screenshots at 390 × 844 and 1280 × 900 were visually inspected.
- Portal type checking passed in the shared workspace after the final test edits.
- All six production builds and their isolation audits passed in the same isolated source snapshot: Jest, Facebook, Reddit, YouTube, Netflix, and Yahoo. Logs are in `artifacts/jest-initial-load/logs`. The snapshot includes current gameplay/economy work so builds avoid interference from simultaneous shared-workspace edits.

## Reproduce

```sh
pnpm --filter @qwordly/portal measure:jest-startup /tmp/jest-startup.json
pnpm --filter @qwordly/portal exec jest --config jest.config.cjs --runInBand src/jest/__tests__/startup.test.ts src/jest/__tests__/commitJestStartupSession.test.ts src/jest/__tests__/startupPreparation.test.ts
PORTAL_BROWSER_TESTS=1 PORTAL_USE_EXISTING_BUILD=1 pnpm --filter @qwordly/portal exec jest --config jest.config.cjs --runInBand src/jest/__tests__/authentication.jest-playwright.test.ts -t 'authenticates during a pending social profile'
```

The browser command requires an existing `build:jest` artifact. `--baseline` reproduces only the old app hydration call site; reproducing the full baseline also requires the pre-change startup/commit source snapshot.
