# Deferred content warmups retain their committed owner

Verified 8 October 2026. The broader game improvement goal remains active.

## Behavior

The lazy host-services facade previously invoked its underlying preloader after the adapter module resolved even if the requesting game owner had already unmounted or changed account. Blocking new warmup calls at a retired frame did not retire an earlier deferred call.

The lifecycle now supplies an optional preparation signal owned by committed content scope and bridge-suspension state. Unmount, account/provider/locale retirement and committed bridge suspension revoke deferred admission. The facade checks cancellation before module loading and again immediately before invoking the provider. It retains the shared module import for other callers. Profile changes and abandoned React renders keep valid deferred preparation alive.

The optional signal is a client lifecycle contract, not a provider SDK argument or server payload. Already-admitted provider work is not remotely cancelled. The facade preserves the original callback return so its existing promise chain continues observing a later callback rejection.

## Diagnosis

The real lifecycle and public createHostServices factory were exercised with only the local fake-adapter module initialization held. Unmount and retired account replacement both opened obsolete preparation after release; the active-owner control passed. The original facade still produces two failing assertions per React mode in the final baseline probe.

A compatibility probe also caught an implementation regression before handoff: a callback return was initially dropped, exposing a later asynchronous rejection. Its retained red observation has one failure; the corrected final facade contains that failure. No obsolete module import is forcibly cancelled.

## Startup budget

The initial cancellation implementation produced 576,779 initial Jest resource bytes, exceeding the unchanged 0.55 MiB limit (576,716.8 bytes). Ordinary and Daily-fallback success delivery had identical snapshot-publication code; diagnostics repeated the same fixed scope. Consolidating these duplicated steps preserves each path's ordering and removes 161 bytes from the failing implementation.

Final initial resources total 576,618 bytes and pass the existing budget. The previous verified game had 576,593 bytes: the final ownership fix therefore adds 25 net bytes relative to that baseline. This is not a claim of improved network RTT, FPS or measured startup time.

A duplicate CSS-rule experiment did not reduce shipped CSS because the compiler already deduplicated it. The experiment was reverted; CSS is unchanged in the final source.

## Verification

- Final full portal suite: 2,991 passed across 304 suites; 96 skipped in 16 suites. Focused lifecycle cohort: 35 passed.
- Deferred module probes in Chromium 153 and Firefox 153, development and production, three viewports: 36 scenarios and 180 assertions passed.
- Adjacent host commit-retirement, recovery coalescing, committed suspension and warmup-admission probes: 140 scenarios and 1,356 assertions passed. These include actual game-frame and PlayHostApp journeys and ordinary/Daily-fallback delivery.
- Supplemental same-account bridge retirement, profile-update and abandoned-render ownership: three scenarios, 16 assertions. Admitted asynchronous failure: one scenario, five assertions. Combined green coverage: 180 scenarios, 1,557 assertions. Explicit diagnostic traces are excluded from assertion counts.
- Final built Jest/Reddit journeys: 22 passed. Fresh Facebook fixture: one passed. Rendered HTML and matching screenshots are retained under `rendered-standards/`; local Nu and automated accessibility checks passed.
- All six isolated client builds and Devvit server passed. YouTube uses the incomplete-content fixture build and does not establish partner release acceptance.
- Types, TSDoc, source-size, locale, license, target-boundary, artifact and security checks passed. The Jest size limit was not raised.

Exactly six selected inputs changed from the preceding verified checkout: services facade, lifecycle, host-services type, recovery unit tests, registered browser probe and package registration. Final verification checks 2,479 selected source inputs, owned snapshots and the reverse diff. The browser command is `test:host-deferred-warmups:browser` and is included in `test:game-browser:playwright`.

Preserved 1,301 final built files plus the prior staging artifacts with SHA-256 hashes, and 14 dependency inventories covering both six-target build roots and both Facebook fixture builds. Only the exact two owned temporary build roots and preserved inventory originals were removed. Final process handles are terminal and drained.

## Limits and next investigation

No visible product text, backend production code, economy grants, server ranking or provider SDK behavior changed. Older authority evidence is not reused to certify independent backend changes. No commit, push, deployment or publication occurred.

Next investigate deferred visible-riddle admission through the same lazy facade. loadRiddle currently awaits the adapter module before invoking the underlying method, independently of the lifecycle's bounded local wait. That requires its own reproduction; this warmup fix does not claim to prevent every deferred authority read after retirement.

## Evidence

Root: `artifacts/host-deferred-warmups-2026-10-08/`.

```sh
python3 artifacts/host-deferred-warmups-2026-10-08/verify.py
```

The verifier checks final source hashes, exact six-input change scope, owned snapshots/reverse diff, green observations and available screenshots, original-facade and admitted-failure red counts, supplemental harness hashes, final unit/build/static summaries, measured initial resource bytes, rendered standards snapshots, preserved artifact bytes and exact cleanup. The summary records that the goal is unfinished and authority evidence was not reused.
