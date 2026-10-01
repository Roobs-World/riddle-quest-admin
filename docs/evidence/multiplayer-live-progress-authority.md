# Multiplayer live progress authority

The shared public race schema now rejects active views whose cleared-riddle count exceeds the current question position or reaches the completion target while still active. Supported legacy runs may have fewer clears than their question position; this change deliberately preserves that contract.

Four impossible progress cases failed before the fix. Five valid current and legacy cases pass. The full core suite passes 193 tests across 22 suites. Client start and resume tests reject impossible progress, avoid saving invalid resume hints, retain the typed draft, and recover after a valid resume. The full client race suite passes 464 tests across 34 suites.

An existing outcome-corruption fixture incorrectly claimed five clears while still showing question zero. It now uses question five and explicitly asserts that the initial setup is accepted before testing outcome corruption.

The injected browser harness exercises score-ahead and already-at-target corruption on desktop and mobile. All four cases reject the invalid start without sending readiness, then accept a valid retry. The mobile recovery screenshot was inspected: question, score, keyboard and paid action controls fit the viewport. Shared core distribution was rebuilt before browser verification. Portal type checking passes.

The accompanying development task runs the full backend emulator coverage, types and lint, client and core suites, architecture safeguards, browser harness, routing checks and seven isolated platform builds. Completion is recorded only after all gates pass and the source digest remains unchanged.

The first full validation stopped at backend compilation: a concurrent supported-locale update removed Chinese while leaving an unused Chinese script rule in the translation validator. The orphan rule was removed to match the existing supported-locale list. The subsequent backend run found three stale locale fixtures: Chinese was still tested as supported, and corpus totals still included its 180 records. Fixtures now reflect the existing 16-locale list and 2,700 non-English records, preserving missing-bundle, duplicate-bundle and per-locale quality assertions. No visible text or locale content was changed by this task.

The next full run passed backend coverage but platform compilation found an orphan Chinese language label after the same locale removal. That unused label was removed from the typed language-label map; translation files and current locale selection were preserved.

This local verification does not upload or publish a Jest game or deploy Functions. Jest activation and Firebase Functions deployment are authorized; game publication, review submission and listing visibility remain held. The ongoing reliability audit remains active.
