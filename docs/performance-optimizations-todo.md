# Performance Optimization TODO

- [x] Memoize modal renders at the provider boundary
- [x] Stabilize heavy GameScreen props/callbacks to reduce avoidable re-renders
- [x] Throttle coin text updates during count-up animations
- [x] Lazy-load non-critical data flows (IAP/pricing) instead of loading on mount
- [x] Reduce expensive SVG work in hot paths
- [x] Cut effect churn around modal visibility transitions
- [x] Add production logging guardrails in frequently-hit handlers

## Follow-up ownership

- Audit complete: 2026-05-30
- Benchmark owner: Frontend performance
- Automation owner: CI / RN tooling
- Current ownership note: this checklist is actively owned by the current docs thread and should not be parallel-edited until the tracker refresh lands.
- 2026-05-30 refresh: the audit is still complete and the remaining benchmark/automation work is now explicitly owned. Real launch and bundle-size measurements were captured in the RN baseline file this pass, and the new bundle smoke gate passed with a 10,726,291-byte Android Hermes bundle and 42,007ms export elapsed time.
- 2026-05-30 continuation: the RN 0.85 baseline template is now initialized at `docs/memory-bank/rn-0.85-baseline.md` and now includes measured startup and bundle values plus the still-pending memory/render entries.
- Work-in-progress lock: this checklist remains under the active docs pass until the generated tracker is refreshed.

## Measurement targets

- Startup time to first interactive screen
- Memory snapshots around scene preload and modal-heavy flows
- Render jank on hot game and modal transition paths
- Bundle-size smoke gate: `pnpm run perf:bundle-smoke`
