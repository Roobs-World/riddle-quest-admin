# Live PvP lifecycle and clock recovery — 2026-10-02

The live lobby could leave a server-owned seat behind when the React journey was unmounted without calling its visible Close handler. This includes entry/account replacement and removal of the live capability. Both a timely join response and an expired join's late response were ignored after unmount without retiring the newly established seat. Separately, the countdown advanced from `Date.now()` plus a stored offset, so a device clock correction could start the UI early or delay it.

## Changes

- Real effect retirement now sends an idempotent leave for its accepted seat. Cleanup is deferred to a microtask so React Strict Mode's synchronous setup/cleanup replay and an equivalent transport refresh keep the active journey alive.
- Join and poll receipts arriving after retirement send leave using their original transport. This also covers responses arriving after the delivery deadline.
- Repeated retirement attempts reuse one leave request ID. Terminal result/cancelled snapshots do not send another leave.
- Countdown animation, input admission and command admission reuse the existing `estimatedRaceServerNow` function, anchored to the latest server receipt and `performance.now()`. Device wall-clock changes cannot advance or rewind that estimate.
- No visible copy or target SDK dependencies were added.

## Evidence

Two separate baseline runs load an exact pre-change component snapshot through a Vite test plugin, without changing the production source:

1. `artifacts/live-pvp-lifecycle/baseline-browser.log`: original component fails because a joined seat still exists three seconds after real unmount.
2. `artifacts/live-pvp-lifecycle/clock-baseline-browser.log`: original component fails because a one-hour forward device clock change renders gameplay before the scheduled server start.

The changed actual React UI passes ten injected lifecycle/clock cases: at each of 1280 and 390 pixels, unmount with an accepted seat, unmount before a delayed join receipt, unmount after a join delivery deadline, forward one-hour wall-clock correction, and backward one-hour correction. Delayed joins establish fixture seats before unmount; their receipts are explicitly released afterward. Every retirement case verifies removal of the owned seat and reuse of the same leave request ID. Countdown cases suppress subsequent polls, proving that local clock correction rather than a fresh receipt is being resisted. No page errors occur. See `artifacts/live-pvp-lifecycle/browser.log` and clock screenshots.

The existing live PvP happy-path verifier and the previous delivery recovery verifier pass again. Queued guesses escape hung polls in 2,000–2,002 ms; accepted-command retries remain idempotent. Desktop/mobile victory and bot fallback still pass.

Portal types pass. The full portal unit suite passes 254 suites and 2,047 tests; 14 optional browser suites / 108 tests are skipped. All seven isolated target builds and their target audits pass. The maintainable-file size audit passes for 1,039 files. Logs are under `artifacts/live-pvp-lifecycle/`. Jest was not uploaded or published, and Firebase was not deployed.

The workspace TSDoc gate still reports the same 27 declarations in concurrent classic supply-worker work. The automatic dashboard receipt remains pending; this evidence does not claim full-plan completion or a source-stable guarded receipt. `docs/common/development/development-tasks/live-pvp-lifecycle-recovery.json` preserves the retained checks and adds the new lifecycle verifier, for 148 checks total.

Seat cleanup is best-effort delivery through the approved adapter. The injected browser transport verifies frontend ownership and command identity, rather than guaranteeing delivery across a real network outage or an already-invalid authentication session. Server deadlines remain necessary. No backend settlement behavior changed in this batch.
