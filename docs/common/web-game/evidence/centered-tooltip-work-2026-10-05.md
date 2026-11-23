# Centered tooltip layout work — 5 October 2026

`TooltipOverlay` now measures its card and registers a card ResizeObserver only when it has a target rectangle. Centered tooltips already use native CSS centering, so their measured height and stored viewport height never affect placement. Skipping this effect avoids synchronous geometry reads, observer setup, and the resulting measurement state update on the question transition that opens the leaderboard tooltip.

Anchored tooltips retain their existing measurement, resize listener, and observer. Switching from anchored to centered placement cleans them up immediately. Existing translated content, markup, focus behavior, dismissal, target boundaries and authority rules remain intact. This change preserves the shared checkout's earlier heading correction.

## Diagnosis

The preceding buffered question-transition investigation used an immutable 411-file Jest artifact. CPU-throttled traces showed synchronous tooltip geometry work among several rendering and parsing costs. The guidance-history comparison opened `leaderboardFifthCorrectAnswer` only in the unseen-history runs, but timing remained variable even when it was absent. That evidence identified a concrete unnecessary operation; it did not establish the cause of the earlier 112.4 ms threshold failure.

The focused regression drives the real TooltipOverlay with real translated content in StrictMode. Original entry performed four panel geometry reads and held one observer; returning to centered placement added two readings and retained an observer; a centered resize added another reading. All three original minimal runs failed the same five of 21 assertions. Anchored placement and dismissal controls passed in the original fixture. The scoped fix passed 189 assertions, and the final frozen minimal comparison passed 21 of 21.

## Verification

- Development and production React: 1,008 assertions per mode, zero failures across 16 locales and three viewport sizes (96 journeys). Checks include 32 native parent updates, long translated cards, centered/anchored transitions, viewport resize, exactly-once native advance, observer cleanup and browser errors.
- Guidance progress under blocked or failing storage: 114 assertions per mode, zero failures. Combined focused and related total: 2,244 assertions.
- Firefox MCP independently recorded original centered entry at four geometry readings/one observer and repaired entry at zero/zero. Anchored placement remained measurable and visible; returning to centered placement added no readings and removed the observer. Native Got it dismissed once with no remaining observer, errors or unhandled rejection. Dismissal's final reading counter includes browser-driver interaction and is not used as a production work delta.
- Portal unit tests: 2,758 passed in 297 suites; types and TSDoc passed (25,215 declarations across 1,140 files).
- All six isolated target builds and their artifact audits passed. YouTube used the explicit fixture build; this is not YouTube release certification.
- Eight built-game tests in three suites passed against the newly built temporary Jest/Reddit artifacts, covering hosted gameplay/navigation, Profile guidance and Reddit flows. The existing feedback and buffered-transition latency limits were unchanged.
- 1,501 selected source inputs, including content, locales, target configuration, browser verifiers and release scripts, were unchanged throughout final verification. Captured after-files match current source. Exact own changes are in `own.diff`.

The initial custom build directory inside the checkout was rejected by the existing output safety contract. It was replaced with a unique external `/tmp` directory without weakening that contract. All 1,300 built files were copied into the evidence directory, their hashes compared, and the temporary build directory removed. Both Firefox servers exited successfully, their fixture caches were removed, and only this pass's tabs were closed.

## Limits and continued work

This pass proves elimination of unnecessary centered-tooltip layout work. It does not claim a measured end-to-end speedup, resolve every throttled timing spike, or certify real multiplayer network latency. The immutable timing results and their limitations are documented separately in `buffered-transition-timing-2026-10-05.md`. Further investigation can distinguish bridge parsing, checkpoint restoration, rendering and frame scheduling with controlled probes. The broader reliability, performance, playability and latency goal remains active.

Raw observations, logs, source captures, screenshots, build hashes, Firefox records and `verification-summary.json` are in `artifacts/centered-tooltip-work-2026-10-05/`. No commit, push, deployment or provider SDK change was made.
