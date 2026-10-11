# Live checkpoint polling work — 2026-10-09

The current multiplayer UI performs one synchronous checkpoint read for each unchanged authoritative refresh. It performs no setItem or removeItem calls in this situation. Write deduplication already works; speculative write optimization would address no observed duplicate write.

An artifact-only injected browser probe wraps the actual Storage prototype methods before the current RaceTo10Game UI starts, filtering the account-specific live draft key. After typing `te`, it requests five online refreshes and records persistence calls over that interval. Chromium 153.0.8010.12 and Firefox 153.0, React development/production, widths 390/1280: eight journeys, 64 assertions. Each interval observed exactly five reads, zero writes and zero removals, with the partial draft intact and no browser errors or unhandled rejections. Aggregate work: forty reads, no mutations. No duration or production latency benefit is measured. Background polling is allowed, so these are interval observations rather than isolated timing samples.

The selected four production inputs were hashed before launch and remained identical afterward. The browser process completed successfully; each browser, local server and owned scratch directory closed in finally. This pass changes evidence only, so it does not require new target builds. The preceding full validation remains the latest production validation.

The next candidate is to compare unchanged successfully persisted semantic content before reading storage. An unchanged checkpoint cannot mutate another writer's data. All actual writes and removals must still verify the observed storage revision, including changed canonical bindings and storage-denial recovery. The existing writer-identity and transient-storage cases must remain green. No optimization was applied in this observation pass.

Run `python3 artifacts/live-checkpoint-poll-work-2026-10-09/verify.py` from the repository root. Raw method counts are in `work-summary.json`; individual assertions and logs are retained for all four browser/React configurations.
