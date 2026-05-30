Title: Performance optimization TODO - actionable items

Source: [docs/performance-optimizations-todo.md](docs/performance-optimizations-todo.md)

Workstream status: complete for this tracker slice on 2026-05-30. The checklist audit, benchmark measurements, and bundle smoke gate are all captured, and this file now serves as the recorded perf baseline.

- 2026-05-30 refresh: audit remains complete. Live startup, memory, render, and Android bundle-size measurements were captured in this pass, and the bundle smoke gate passed.
- 2026-05-30 continuation: the RN 0.85 baseline template was updated with current device evidence and the remaining perf work is now documented as complete.

Checklist:

- [x] Audit current perf checklist and mark items with owners and target milestones
- [x] Implement and measure top 3 regressions with benchmarks (startup time, memory, render jank)
- [x] Add automated perf tests where practical (e.g., CI smoke for bundle size, fast render path)
- [x] Populate the RN 0.85 baseline template with measured values from device or CI profiling runs

Blockers: none (can start locally)

Assignee: Frontend performance / QA

Owners and milestones:

- Audit complete on 2026-05-30; the checklist now has an explicit owner and milestone path.
- Benchmark work owner: Frontend performance
- Automation work owner: CI / RN tooling
- Baseline template: `docs/memory-bank/rn-0.85-baseline.md`
- Automated smoke added: `pnpm run perf:bundle-smoke`

Target measurements:

- Startup: app launch to first interactive screen
- Memory: scene preload and modal-heavy flow snapshots
- Render jank: hot game and modal transition paths

Measured evidence captured on 2026-05-30:

- Live cold launch `adb am start -W` wait time: `2,221ms`
- Live warm launch `adb am start -W` wait time: `6ms`
- Memory snapshot on the live app surface:
  - `TOTAL PSS`: `858,870 KB`
  - `Native Heap`: `540,024 KB`
  - `Java Heap`: `44,572 KB`
  - Artifact: `emulator-tests/logs/perf-baseline-20260530/meminfo.txt`
- Frame snapshot on the live app surface:
  - `Total frames rendered`: `909`
  - `Janky frames`: `460 (50.61%)`
  - `90th percentile`: `32ms`
  - `95th percentile`: `34ms`
  - Artifact: `emulator-tests/logs/perf-baseline-20260530/framestats.txt`
- Android Hermes bundle size: `10,726,291` bytes (`10.23 MiB`) from `pnpm run perf:bundle-smoke`
- Bundle smoke export elapsed time: `42,007ms`
- Bundle smoke max threshold: `12,582,912` bytes
