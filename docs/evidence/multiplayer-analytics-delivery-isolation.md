# Multiplayer optional analytics delivery isolation

Verified 2026-10-01 against local production source. The hosted Jest E2E preview and evidence file remain untouched.

## Failure and change

The multiplayer analytics adapter caught synchronous host exceptions but ignored returned promises. A production browser fixture reproduced three unhandled analytics rejections during race startup. Its synchronous-failure desktop and mobile controls passed against the saved prior game module.

The game adapter now consumes rejected optional telemetry delivery promises. Its host delivery type explicitly supports synchronous completion and Promise<void>, matching the session transport contract. Required gameplay command rejection continues through the separate delivery recovery path. Analytics failure never changes canonical scoring or player actions, and no event fields or translated text changed.

## Verification

- Four injected browser cases passed: synchronous analytics throws and asynchronous analytics rejections, each at 1280px and 390px. Each starts exactly one valid race, reaches gameplay, accepts APPLE input and checks actual analytics delivery, no alerts and no page errors. Prior-source substitution reproduces the asynchronous page errors.
- Complete client suite: 1,630 tests in 188 runnable suites passed; 95 tests in 13 opt-in suites skipped. This includes the required-command asynchronous rejection ownership cases.
- All seven isolated builds and exact dependency evidence verification passed.
- Portal types, TSDoc, file size, security and scalability checks passed.

The harness renders production RaceTo10Game, session, analytics message builder and styles. Fake authority supplies a valid category catalog and race response through the host bridge; only telemetry delivery is deliberately rejected. Logs, screenshots, saved prior game module and source/build hashes are in `artifacts/race-analytics-delivery-isolation/`. This verifies the adapter failure contract rather than claiming a deployed target currently rejects analytics delivery. No Firebase deployment or provider SDK change is required.

## Completion receipt

`verification-held.json` records focused evidence, not an accepted full-source dashboard receipt. The 46-check manifest `docs/development-tasks/race-analytics-delivery-isolation.json` retains previous gates and adds this actual-browser telemetry failure check. Guarded completion awaits the active hosted E2E chat finishing source evidence edits; the source-stability guard remains unchanged. No Jest upload, activation or publication was performed. The multiplayer reliability audit remains active.
