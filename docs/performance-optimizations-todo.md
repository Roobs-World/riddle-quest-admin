# Performance Optimization TODO

- [x] Memoize modal renders at the provider boundary
- [x] Stabilize heavy GameScreen props/callbacks to reduce avoidable re-renders
- [x] Throttle coin text updates during count-up animations
- [x] Lazy-load non-critical data flows (IAP/pricing) instead of loading on mount
- [x] Reduce expensive SVG work in hot paths
- [x] Cut effect churn around modal visibility transitions
- [x] Add production logging guardrails in frequently-hit handlers
