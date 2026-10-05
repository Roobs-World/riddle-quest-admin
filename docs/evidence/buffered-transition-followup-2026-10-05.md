# Buffered transition follow-up — 5 October 2026

The frozen Jest artifact from the centered-tooltip optimization still reproduces transitions over the unchanged 100 ms observation limit under 12× CPU throttling. It contains 411 files, retained in `artifacts/centered-tooltip-work-2026-10-05/built/jest/` with the six-target build manifest.

The follow-up diagnostic is derived from the previous timing harness with an explicit artifact-directory input. It retains fresh contexts, the injected mock host, one sent guess, one held response, no unconfirmed coin chest, and assertions against browser errors or unexpected external origins. It does not change production code, parsing, saves, authority or timing budgets. Exact probe source and parameters are captured per run directory.

The CPU-12 batch completed 20 samples and failed the timing assertion: 19 were at least 100 ms, with a 240.1 ms maximum. The three trace samples had one threshold failure and a 152.8 ms maximum. These are diagnostic observations on a shared machine, not measured player latency or a before/after speedup.

The trace job was started after the first batch's run 15 had been logged, so its setup overlapped the tail of that batch. This overlap prevents treating the two runs as an isolated performance comparison. The preceding first 16 samples already contained 15 threshold failures, with a 182 ms maximum, before that second job started. Both exact process handles were collected to terminal exit 1; each completed its samples and failed only the unchanged timing assertion.

Marked-window CPU samples still contained schema compilation, React/game rendering and guidance-coordinator work. Most samples were native/program entries; these profiles do not identify an exclusive dominant cause. No tooltip-card geometry stack was sampled in these three windows, which is only supporting observation rather than proof of absence. The prior focused work-counter tests provide the actual proof that centered card measurement was removed.

The guidance-coordinator inspection led to a separate deterministic regression: stale translated copy, centered target callbacks, and Arabic spotlight drift. Its controlled prototypes and verified correction are documented in `guidance-locale-work-2026-10-05.md`. Bridge parsing, checkpoint work and frame scheduling remain candidates for further controlled investigation rather than established causes of every timing spike. The broader goal remains active.

Raw samples, traces, CPU sample summaries, captured probe source and parameters are in `artifacts/buffered-transition-followup-2026-10-05/`. Additional frame timestamps are frame boundaries rather than paint measurements. No production tracing or debug output was added.
