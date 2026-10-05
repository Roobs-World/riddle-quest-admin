# Buffered question transition: validation and shared-lock investigation

The remaining transition delay reproduces in the latest verified Jest artifact. The native shared lock used to coordinate ordinary Jest operations with account deletion accounts for a substantial wait before the host calls the content service in the measured fixture. Parsing and checkpoint storage do not explain most of that wait. A completion-presentation retention prototype did not show a consistent improvement and remains diagnostic only.

## Controlled reproduction

The input is the 411-file Jest artifact retained by the live-stream-watchdog pass. Its SHA-256 manifest was checked before and after investigation. Each sample uses a fresh 390×844 browser context, injected mock authority, one sent guess, one held response, and the existing Next-level observation loop. Unconfirmed play cannot show a coin chest. Browser errors and unexpected external origins are asserted empty. CPU throttling begins only once Next level is available.

Two separate, uninstrumented six-sample runs at 12× CPU throttling each fail the unchanged 100 ms observation limit in four samples. Both handles reached terminal exit 1 because of that timing assertion. The observation is a requestAnimationFrame boundary, not a paint measurement or a production latency estimate.

## Probes and findings

There are **57 valid completed diagnostic samples** across the two baseline runs, work counters, frame counters, three traces, delivery boundaries, loader boundaries, native lock counters, and an alternating presentation comparison. Each job ran after its predecessor reached terminal state; no owned probe jobs overlapped.

- Six work-counter samples preserve the actual bridge parsers and their return/throw behavior. Combined bridge validation takes 4.6–6.7 ms; checkpoint storage takes 0–1.3 ms. The first `game:loadRiddle` validation contributes most of the measured parse work. These counters include measurement overhead and do not imply a parser speedup.
- Six frame-counter samples record no `scrollHeight` or `clientHeight` reads on the game shell/content during the transition. Decorative frame and tooltip focus callbacks still run. This rules out viewport fitting in these particular measured windows, not in every layout or device.
- Three current main-thread traces include React work, style/layout work, paint events, and decorative frames. One slow trace also contains a substantial garbage collection pause. Captured event durations are inclusive and may overlap; they must not be added as exclusive CPU cost.
- Loader boundaries show the host handler starting shortly after the click but service invocation much later. The lazy service proxy resolves immediately once it starts.
- Six native lock-counter samples each show one shared-lock request and acquisition. Acquisition waits **48–78 ms**. The content service starts within 0.1 ms of acquisition in every sample, and the lazy implementation resolves within 0.1 ms. The production gate deliberately acquires this origin-wide lock and rechecks deletion state/epoch before calling the service. This establishes where the pre-delivery wait occurs; it does not prove a single cause of all end-to-end spikes or distinguish IPC/task scheduling from every possible source of lock waiting.

The first private modal prototype retained the reducer's victory state. The existing reducer correctly rejected the incoming question while victory remained active, so that candidate timed out. Its incomplete run (one completed control sample) is excluded and retained separately. The corrected prototype preserves logical dismissal and retains only the rendered completion presentation until the question changes.

The corrected comparison alternates six original and six presentation-retention cases, keeping guidance history and other setup constant. The original has three threshold failures, an 89.05 ms median and a 123 ms maximum. Retention has two failures, a **slower 93 ms median** and a 124.5 ms maximum. Its DOM-observation median is modestly lower, but the complete observations do not support shipping it as a latency improvement. The prototype does not cover production retries, duplicate Next taps, identity changes, or focus admission and is not production-ready.

## Scope and next action

No production source, provider adapter, runtime validation, account-deletion gate, persistence behavior, locale, or timing threshold changed. The shared lock remains intact. Avoid removing it or retaining a lock indefinitely to make the timing test pass. The next useful investigation is whether redundant acquisitions can be reduced while preserving cross-tab deletion ordering, generation checks, failure behavior, and bounded ownership. The remaining post-delivery render/observation gap is another distinct candidate.

All 1,507 selected source inputs were re-enumerated and hash-checked unchanged against the preceding verified pass. Its full unit/type/documentation checks, six isolated builds and target audits remain the build evidence for these unchanged sources; this investigation adds no UI implementation. All ten owned jobs reached terminal results, and their harness browsers and servers closed in `finally`. Prototype changes are confined to served responses in these private fixtures; the retained game artifact is unchanged.

Raw observations, exact per-run probe source/parameters, rewritten-response anchors, source/artifact fingerprints, trace timelines, and terminal-job accounting are in `artifacts/buffered-transition-parser-2026-10-05/`. Recheck the assertions with:

```sh
python3 artifacts/buffered-transition-parser-2026-10-05/report-generation.py
```

The broader reliability, performance, playability, and latency goal remains active. This pass narrows the investigation; it does not claim that the remaining latency issue is fixed.
