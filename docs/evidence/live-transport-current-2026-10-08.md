# Current multiplayer scheduling and stream recovery

The current game passed 1,098 assertions in existing Chromium injected browser harnesses: scheduling 237 per React mode and stream recovery 312 per mode. Development and production React both passed. Scheduling also retained 33 diagnostic samples per mode, excluded from assertion counts.

Checks cover healthy push/watchdog cadence, disconnect fallback, hidden/foreground transitions, held commands, outage retry identity, reentrant retirement/replacement, throwing subscriptions and terminal cleanup. Stream checks cover EOF, missing headers/heartbeats, stalled chunks, healthy streams, retirement and pending requests. Each matrix exercised 390×568, 390×844 and 1280×844 viewports. Harness assertions include browser errors, unhandled promises and unexpected external traffic.

No production changes were justified by this pass. This is deterministic local provider injection with diagnostic stream deadlines; it does not measure real backend latency or certify provider outages. No deployment occurred. Existing six-target build evidence is unchanged by this assessment. The unlimited improvement goal remains active.

Evidence: `artifacts/live-transport-current-2026-10-08/verification.json`, separate mode observations, input hashes and terminal logs. All three launched sessions exited zero. Harness finalizers close browsers and loopback servers and remove their own scratch directories. Development scheduling observations were preserved before production replaced the shared initial report directory.
