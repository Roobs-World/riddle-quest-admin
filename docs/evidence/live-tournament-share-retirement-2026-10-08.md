# Tournament share preparation follows committed board retirement

Verified 8 October 2026. The broader reliability, performance, playability and latency goal remains active.

## Behavior

Closing the tournament board during a pending standings read or native metadata lookup could previously open a stale Facebook share/create dialog when that read returned. The pending preparation also occupied the shared SDK dialog gate until the existing eight-second deadline.

The board now creates an AbortController for each admitted share operation. Committed unmount or share-capability replacement aborts its preparation. The target adapter accepts an optional AbortSignal, contains retirement as cancellation, removes its cancellation listener and deadline, and releases the shared SDK gate immediately after local cancellation settles. Original reads stay observed; their late fulfillment or rejection cannot continue into native UI admission.

An already-admitted native share/create dialog retains its original SDK occupancy until natural success, cancellation, or failure. Retirement never releases that dialog early. Profile updates and abandoned React renders retain the original preparation. The optional signal is a client presentation contract and is not passed to the provider SDK or authoritative backend. Official standings and purchase/economy authority are unchanged.

## Diagnosis

The initial corrected browser probe exercised the real RaceTournamentEntry, Facebook tournament presentation, notification adapter and shared gate. Closing during either preparation stage yielded seven failed assertions across three scenarios, while the admitted-dialog control retained its correct occupancy. The focused adapter regression failed both preparation cases before the implementation changed.

Ranked explanations were missing preparation cancellation, presentation-only late-response guards, and incorrect SDK gate ownership. The gate control ruled out premature native-dialog retirement. Connecting committed board ownership to a preparation-only cancellation signal fixed the two actual stale-admission paths.

Two fixture corrections are distinguished from product failures: an empty close marker requires attachment rather than visibility, and the method-replacement control must sit above the game modal. The intercepted-control fixture and log are preserved separately.

## Verification

- Facebook adapter cohort: 39 passed in two suites. Tests cover both preparation stages, already-aborted signals, one shared eight-second budget, optional diagnostic failures, and original native share/create/cancel/failure occupancy after abort.
- Portal unit suite: 2,986 passed across 304 suites; 96 skipped in 16 suites.
- Chromium 153 and Firefox 153, development and production, three viewports: 132 retirement scenarios and 1,236 assertions.
- Adjacent metadata deadline, share ownership and preparation deadline probes: 258 scenarios and 4,398 assertions.
- Minimized green development/production: six scenarios and 56 assertions. Injecting the original adapter produces seven failing assertions per mode, with the same 28-assertion harness.
- Supplemental actual-signal profile/abandoned-render probe: two scenarios and 22 assertions. Combined green coverage: 398 scenarios, 5,712 assertions, with screenshots and no harness-reported browser errors, unhandled rejections or external provider traffic.
- Built Jest/Reddit journeys: 22 passed across four suites. Fresh Facebook fixture: one passed. Rendered HTML and matching screenshots are retained under `rendered-standards/`; local Nu and automated accessibility checks passed.
- All six isolated client artifacts and Devvit server built successfully. YouTube used the incomplete-content fixture build and does not establish partner release acceptance.
- Types, TSDoc, source size, locales, licenses, target boundaries, artifact and security audits passed.

Exactly six selected inputs changed from the preceding verified checkout: the board, target adapter, client capability type, adapter test, browser probe and package registration. All 2,476 selected source hashes stayed unchanged through final builds, runtime checks and cleanup. The reverse diff checks against the current files.

Preserved 1,301 built files and seven dependency inventories with SHA-256 hashes before removing only the exact owned temporary build directory and inventory originals. Every tracked execution session finished and was drained; no task browser job remains pending.

## Limits and next work

This prevents stale native UI and avoids waiting for the full preparation deadline after close. It does not claim reduced server RTT or remotely cancelled provider reads. No new visible product text was added. No backend production source, grants or rewards changed in this pass, and no older authority evidence is reused to certify independent backend changes made before it. No commit, push, deployment or publication occurred.

Continue the broader game audit, including recovery behavior in the externally changed single-player lifecycle and multiplayer server code. Those changes require their own current-state evidence rather than inheriting earlier backend test claims.

## Evidence

Root: `artifacts/live-tournament-share-retirement-2026-10-08/`.

```sh
python3 artifacts/live-tournament-share-retirement-2026-10-08/verify.py
```

The retained verifier checks source immutability, the exact six-input change set, owned snapshots and reverse diff, green browser observations and screenshots, both reproduced red counts, unit/build summaries, supplemental harness hash, rendered standards snapshots, preserved artifact bytes and exact cleanup. The summary explicitly records that the goal is unfinished and authority evidence was not reused.
