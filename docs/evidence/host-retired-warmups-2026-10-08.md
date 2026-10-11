# Retired game frames do not admit new content warmups

Verified 8 October 2026. The broader game improvement goal remains active.

## Result

A suspended recovery owner still invoked optional preloadInitialRiddles when its effect mounted or an account change installed a replacement context. Firebase and Reddit implementations can use this call to download Classic and Daily content even though the bridge-retired frame cannot display it.

Warmup admission now checks the latest committed recovery-suspension state. Active startup continues preparing content. The effect still installs recovery listeners, and the existing read guard retains its behavior. Previously admitted provider work is not remotely cancelled. This change blocks new optional preloader calls for retired contexts; it does not claim that every provider call represents two uncached network requests or that server round-trip time improved.

## Reproduction

Focused unit regressions failed both retired startup and retired account replacement before the fix; the active startup control passed. The real React lifecycle browser probe also produced two failed assertions across the same three scenarios.

The ranked explanations were missing warmup suspension admission, incorrect timer retirement and incorrect account ownership. The timer/account read controls passed, while warmup calls still occurred. Applying the existing committed suspension guard to preloader admission fixed the minimized loop.

The browser regression is registered as `test:host-retired-warmups:browser` and included in `test:game-browser:playwright`.

## Verification

- Focused lifecycle/recovery units: 33 passed in two suites. Original red cohort: two failed, 22 passed.
- Full final portal suite: 2,989 passed across 304 suites; 96 skipped in 16 suites.
- New Chromium 153 and Firefox 153 probes, development and production, three viewports: 36 scenarios and 192 assertions passed.
- Adjacent host commit-retirement, recovery coalescing and committed-suspension probes: 122 scenarios and 1,260 assertions passed. The first two use the actual game frame and PlayHostApp recovery journeys.
- Minimized green probes in both React modes: six scenarios and 32 assertions. Injecting the original lifecycle yields two failing assertions per mode. Combined green coverage: 164 scenarios and 1,484 assertions. Explicit diagnostic trace rows are not counted as assertions.
- Final rebuilt Jest/Reddit journeys: 22 tests passed. Fresh Facebook fixture: one passed. Rendered HTML and screenshots are retained under `rendered-standards/`; local Nu and automated accessibility checks passed.
- All six isolated client builds and the Devvit server build passed their audits. YouTube uses the incomplete-content fixture build; partner release acceptance is not established by that build.
- Types, TSDoc, source-size, locale, license, target-boundary, artifact and security checks passed.

The documentation audit required a comment for one new test fixture. After adding it, the source was frozen again and all six artifacts rebuilt. The regenerated artifacts differed from the earlier output bytes, so the final built-game checks were run again directly against the final outputs. The comparison and earlier logs are retained separately; no artifact byte-equivalence claim is made.

Exactly four selected inputs changed from the preceding verified checkout: the lifecycle, recovery unit tests, browser probe and package registration. Final source verification covers 2,478 selected inputs and the owned before/after snapshots and reverse diff. The original suspension feature and unrelated checkout edits were preserved.

Preserved 1,301 final built files and eight dependency inventories with SHA-256 hashes. The inventories include both Facebook fixture builds. Removed only the exact owned build root and preserved inventory originals. All final execution handles are terminal and drained.

## Scope and next investigation

No visible product text, economy authority, provider SDK behavior, backend production source, rankings or rewards changed. Older backend authority evidence is not reused to certify independent backend changes. No commit, push, deployment or publication occurred.

Next investigate deferred warmup admission through the lazy host-services facade. Its preloadInitialRiddles wrapper waits for the target module before invoking the underlying method, so an earlier admitted wrapper call may start its provider work after its original context retires. That requires a separate reproduction and ownership contract; this pass does not claim to cancel those already-admitted wrapper calls.

## Evidence

Root: `artifacts/host-retired-warmups-2026-10-08/`.

```sh
python3 artifacts/host-retired-warmups-2026-10-08/verify.py
```

The verifier checks final source hashes, exact four-input change scope, owned snapshots and reverse diff, green observations and available screenshots, both reproduced red counts, unit/build/static summaries, rendered standards snapshots, preserved artifact bytes and exact cleanup. The summary records that the overall goal remains unfinished and authority evidence was not reused.
