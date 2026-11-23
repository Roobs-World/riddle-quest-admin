# Single-player recovery suspension belongs to committed React state

Verified 8 October 2026. The broader game improvement goal remains active.

## Result

Recovery timers and reconnect callbacks previously read a suspension ref updated during render. An abandoned concurrent render could therefore suppress recovery for a still-active committed owner, or admit a provider read while the committed owner remained suspended. The actual lifecycle browser probe reproduced both failures while retaining the previous rendered owner.

The suspension ref now updates in the existing layout effect alongside the latest committed recovery callback and load implementation. Abandoned renders cannot change admission. Committed suspension still prevents automatic recovery reads, and the existing account/content lifetime and retry schedule remain intact. The fix preserves the previously added bridge-failure suspension feature and all unrelated checkout edits.

## Diagnosis and regression

The initial corrected probe reported six failed assertions across three scenarios: abandoned suspension prevented the expected read, recovery callback and content delivery; abandoned resumption admitted all three when they should remain suppressed. Committed suspension was the passing control.

Ranked hypotheses were a render-phase ref mutation, a stale timer, or changed service ownership. The harness held the original timer and provider identity stable and used real React Suspense transitions around the actual useHostRiddleLifecycle hook. Updating the ref only at commit fixed the original loop.

The final regression covers both the scheduled retry and reconnect-event paths. With the original lifecycle injected, development and production each produce 12 failed assertions out of 46. With the current source, both pass. A fixture bridge-message spelling correction is preserved separately and is not counted as a product defect.

The command is registered as `test:host-recovery-suspension:browser` and included in `test:game-browser:playwright`.

## Verification

- Focused lifecycle/recovery unit cohort: 30 passed across two suites.
- Full portal unit suite: 2,986 passed across 304 suites; 96 skipped in 16 suites.
- New Chromium 153 and Firefox 153 probes, development and production, three viewports: 72 scenarios and 552 assertions passed.
- Existing host commit-retirement and recovery-coalescing probes, both React modes: 86 scenarios and 984 assertions passed. These exercise the actual game frame and full PlayHostApp recovery journeys, including recovered native answer input.
- Final minimized green probes: 12 scenarios and 92 assertions. Combined green coverage: 170 scenarios and 1,628 assertions. Diagnostic trace records in the coalescing probe are retained separately and are not counted as assertions.
- Built Jest/Reddit browser journeys: 22 tests passed. Fresh Facebook fixture: one passed, including immediate feedback and next-draft behavior. Rendered HTML and matching screenshots are retained under `rendered-standards/`; local Nu and automated accessibility checks passed.
- All six isolated client artifacts and the Devvit server built and passed their audits. YouTube used the incomplete-content fixture build; partner release acceptance is not established by that build.
- Types, TSDoc, source-size, locale, license, target-boundary, artifact and security checks passed.

Exactly three selected inputs changed from the preceding verified checkout: the lifecycle, its new browser regression and package registration. All 2,477 selected source hashes stayed unchanged after builds, runtime verification and cleanup. Owned before/after snapshots and the reverse diff validate the change against the current worktree.

Preserved 1,301 built files and seven dependency inventories with SHA-256 hashes before removing only the exact owned temporary build root and preserved inventory originals. All tracked execution sessions are terminal and drained.

## Scope and remaining investigation

This fixes recovery admission and playability under abandoned React updates. It does not claim an improvement to network round-trip time or remotely cancel provider work. No visible product text, economy grants, server rankings or provider SDK contracts changed. No backend production source changed in this pass, and older authority evidence is not reused to certify independent backend changes. No commit, push, publication or deployment occurred.

Next, examine initial content warmups during committed bridge retirement. The recovery effect still invokes optional preloadInitialRiddles independently of its automatic-read suspension checks; Firebase and Reddit implementations can issue Classic and Daily downloads. That is an investigation candidate, not a claim that all warmups are incorrect or an unverified proposed fix.

## Evidence

Root: `artifacts/host-recovery-suspension-2026-10-08/`.

```sh
python3 artifacts/host-recovery-suspension-2026-10-08/verify.py
```

The verifier checks the current source hashes, exact three-input change set, owned snapshots and reverse diff, green observations and available screenshots, both original-source failure counts, unit and build summaries, rendered standards snapshots, preserved artifact bytes and exact cleanup. It excludes explicitly marked diagnostic traces from assertion counts. The summary records that the broader goal remains unfinished and authority evidence was not reused.
