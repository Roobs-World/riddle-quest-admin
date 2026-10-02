# Live PvP delivery recovery — 2026-10-02

Live PvP previously held its single delivery lock indefinitely if an adapter promise never settled. A hung join could leave the lobby without an identity; a hung background poll could prevent a queued guess from reaching the server; an accepted guess with a lost response could leave the player unable to retry.

`LiveRaceGame` now bounds background poll waits to two seconds and join/player-command waits to ten seconds. Expiration releases the presentation lock without claiming that a server mutation was cancelled. Exact pending command and join request IDs survive recovery. Late responses cannot replace an accepted snapshot; a late seat receipt can still trigger leave after the player closes the lobby. The existing translated error and Retry UI is reused. Join recovery also uses the existing polling loop.

## Verification

- The original component snapshot fails the dedicated injected browser regression: a hung join never produces the player's lobby identity within 15 seconds. `artifacts/live-pvp-delivery/baseline-browser.log` records this expected failure.
- The changed component passes all three injected faults at 1280 and 390 pixels: hung join recovery with the same request ID; a queued guess released from a hung poll in 2,001 ms; and explicit retry of a server-accepted guess with a lost response. The last two guess deliveries use the same request ID, and the fixture remains at two solves rather than three. No browser page errors occurred. See `artifacts/live-pvp-delivery/browser.log` and recovered screenshots.
- The retained live PvP browser verifier passes desktop/mobile lobby identities, countdown, two-player progress, immediate victory, winner-only 50-coin reward, single completion notification, and mobile bot fallback. See `artifacts/live-pvp-delivery/happy-browser.log`.
- Five deadline unit tests pass, including timely settlement, late settlement/cleanup, and late rejection. Portal types pass.
- Full portal unit suite: 254 suites / 2,047 tests pass; 14 optional browser suites / 107 tests skipped. Two Firebase fixture assertions were updated to cover the newly introduced `joinLiveRace` and `updateLiveRace` endpoint declarations and their multiplayer region routing. `artifacts/live-pvp-delivery/client-tests.log` records the successful rerun.
- All seven existing isolated target builds pass (Jest, Facebook, Reddit, YouTube, Netflix, Yahoo, GameSnacks), including their target audits. No build was uploaded or published. See `artifacts/live-pvp-delivery/builds.log`.
- Maintainable-file size audit passes for 1,039 source files. The workspace TSDoc gate still reports 27 declarations in concurrent classic supply-worker work, outside this change. No automatic dashboard completion receipt is claimed.

The recovery browser uses a local injected transport and idempotent fixture. It verifies actual React UI delivery and request reuse; it does not measure production latency or substitute for backend concurrency/emulator verification. Expiring the UI wait cannot abort an unresolved adapter/network operation.

`docs/development-tasks/live-pvp-delivery-recovery.json` preserves all 145 retained reliability checks and adds the existing live PvP happy-path verifier and the new delivery-fault verifier. The whole-plan source-stable dashboard gate remains pending while the shared workspace and other full-pathway audit are active.
