# Deferred visible-riddle admission

A visible riddle request could retire while its target module was still loading, then start a provider read when the module arrived. Existing UI guards suppressed its response but did not prevent the obsolete read.

The public lazy services facade now accepts the original optional AbortSignal separately from the authority input and checks it before and after module loading. The host supplies its existing delivery signal for ordinary reads and Daily-to-Classic routing, and its context signal for successor preparation. Provider work already admitted retains its original promise; this does not claim remote cancellation. Shared module loading remains available to active owners.

The real public factory and React lifecycle reproduce two stale reads with the original facade in both React modes. The final injected browser regression covers unmount, committed account replacement and active-owner delivery in native Chromium and Firefox, development and production, at three viewports: 36 cases and 216 assertions. Adjacent commit, coalescing, suspension and warmup probes pass another 140 cases and 1,356 assertions.

All 2,991 portal unit tests pass (96 skipped), plus types, TSDoc and source-size audits. All six isolated target artifacts and the Devvit server build pass. YouTube is an incomplete-content fixture build, not partner release acceptance. Jest initial referenced resources measure 576,711 bytes against the unchanged 576,716.8-byte budget. This leaves only 5.8 bytes of headroom and requires attention on future changes.

Evidence is under `artifacts/host-deferred-riddle-2026-10-08/`: source manifests, seven owned-file snapshots and reversible diff, native browser observations/screenshots, original-facade reds, unit/static/build logs, built artifacts and hashes. Built-game verification covers Jest, Reddit and Facebook with injected provider harnesses and rendered standards snapshots.

The next real browser probe finds one remaining failure: an expired 15-second local wait can still admit its deferred provider read. That is separate from owner retirement and remains unfinished. The overall improvement goal remains active. No backend authority certification from an earlier checkout is reused, and nothing is deployed.
