# Buffered question-transition timing investigation — 5 October 2026

The existing hosted-game test previously observed one buffered transition at 112.4 ms against its unchanged 100 ms limit. Its unchanged rerun passed. This investigation reproduced slow transitions under CPU throttling, identified unnecessary centered-tooltip geometry work, and produced the separately verified TooltipOverlay optimization. It does not establish the sole cause of the original failure or claim that all timing spikes have been removed.

## Controlled input

The diagnostic harness serves a frozen copy of the existing Jest artifact: 411 files with a checked SHA-256 manifest. It uses a fresh 390 × 844 browser context for each run, the injected Jest mock harness, and a held first guess response. Exactly one guess is sent and exactly one response is held. Unconfirmed play cannot display a coin chest. External requests are blocked except the locally stubbed Jest bootstrap script; browser errors and unexpected external origins are asserted empty.

After the projected victory sequence reaches Next level, the harness uses the same button evaluation and requestAnimationFrame observation loop as the existing hosted test. CPU throttling begins only at that point. Optional DOM and long-task observers, traces, or guidance-history seeds are varied in separate probes. The 100 ms assertion remains unchanged. A diagnostic measure-only flag records a distribution; it does not change the product or production test budget.

There are 200 completed samples across ten probes. The earliest capture has fewer metadata fields than later captures; later probe directories include their exact `probe-source.mjs` and `parameters.json`. Raw samples and `diagnosis-summary.json` are under `artifacts/buffered-transition-timing-2026-10-05/`.

| Probe directory | Runs | At least 100 ms | Median observed ms | Maximum observed ms |
| --- | ---: | ---: | ---: | ---: |
| baseline | 10 | 0 | 24.35 | 26.2 |
| cpu-4 | 20 | 0 | 35.8 | 55.7 |
| cpu-8 | 20 | 10 | 107.9 | 168.6 |
| cpu-8-repeat | 20 | 3 | 79.8 | 106.6 |
| no-dom-observer, CPU 8 | 20 | 2 | 80.8 | 107.4 |
| no-observers, CPU 8 | 20 | 1 | 76.15 | 126.1 |
| minimal-cpu-12 | 20 | 8 | 91.65 | 123.1 |
| traces, CPU 12 | 10 | 9 | 120.8 | 149.1 |
| guidance-seen, CPU 12 | 20 | 0 | 65.1 | 95.3 |
| guidance-pairs, CPU 12 | 40 | 29 | 123.95 | 313.3 |

These are separate diagnostic runs on a shared machine, rather than production latency estimates. Repeat variance and trace overhead prevent comparing every row as a causal performance delta. The observation loop reports when it sees the new question; its additional next-frame timestamp is a frame boundary, not a paint measurement. In the older `no-dom-observer` output, `domCommitMs` was a fallback to the observation time and is not an actual DOM-commit measurement. Later probes correctly report null when that observer is disabled.

## Findings

The initial ranked hypotheses were question-switch layout, rendering/decorations, checkpoint serialization/storage, and frame scheduling. Marked-window Chromium traces captured geometry/style work, JavaScript function work, paint events, React rendering, game bridge parsing, checkpoint restoration, Three/Solar work, and garbage collection. Inclusive trace event durations are not exclusive CPU time; the CPU samples are also only observations of these paths.

One actionable trace frame was TooltipOverlay's `measure` calling `getBoundingClientRect`. The leaderboard tooltip has no target selector and uses centered placement. `getTooltipPanelStyle` returns CSS centering immediately for a null target, so its measured panel dimensions do not participate in that placement.

The alternating guidance-history probe kept other fixture setup constant and used fresh contexts. Unseen-history runs opened `leaderboardFifthCorrectAnswer` after Next level in all 20 cases; seen-history runs opened no tooltip in all 20. Unseen runs had 18 threshold failures with a 137.55 ms median; seen runs had 11 with a 114.55 ms median and a higher worst case. This supports investigating guidance work, but the remaining slow seen-history runs and ambient variance rule out treating guidance as the complete explanation.

A focused component regression then isolated the unnecessary operation independently of timing noise. The original component repeatedly failed the same five work assertions while its anchored geometry controls passed. The fix gates panel measurement and observer setup on the presence of a target rectangle. Its original/fixed comparisons, 16-locale browser verification, Firefox checks, built-game tests, six target builds, and source stability evidence are documented in `centered-tooltip-work-2026-10-05.md`.

## Remaining investigation

The confirmed result is elimination of centered-tooltip measurements and its card observer. The broader latency goal remains active. Bridge parsing, checkpoint restoration, rendering and frame scheduling remain candidates for controlled probes; they have not been proven responsible for the remaining spikes. No parser validation, authority boundary, save behavior, provider integration or latency threshold was weakened to make these results pass.
