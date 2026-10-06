# Partial native overlays retire promptly and observe late SDK results

Optional player-overlay initialization now receives a mount-owned cancellation signal and an eight-second deadline. Committed retirement removes the surface and cancels initialization immediately. Profile updates and abandoned provider renders keep the original operation and deadline. Successful initialization clears the deadline and retains its normal disposer.

The Facebook adapter leases each native creation independently. Cancellation immediately starts cleanup for completed views, completes the local renderer without waiting for a stalled creation or dismissal, and retains observers on original SDK operations. A late-created view receives its own cleanup; a late SDK rejection remains observed. Cleanup is recorded before invoking the SDK, so repeated abort, failure and disposer paths cannot reclaim an allocation twice. Already admitted native calls continue with their original SDK semantics.

Show operations are observed before SDK invocation and validate ownership individually. A picture show that synchronously cancels the scope cannot start a name show. Its rejection is also contained, rather than escaping when another show admission is rejected.

## Measured reproduction

The minimized injected browser harness imports the actual React race entry and Facebook overlay adapter. Picture creation completes, name creation stays pending, and native actions replace the player or provider. The original source leaves the picture undisposed until name creation finally settles. Both development and production fail four assertions: no dismissal and no destruction occur before the original name result. Final exact original-snapshot replays preserve those failures; the final source reclaims the picture before the held name request settles and reclaims the original late name afterward.

The maintained expanded harness separately controls picture, name, show and dismissal operations. It drives picture/name/show retirement, player/provider/method/account replacement, deadline expiry, profile updates before deadline, abandoned replacement, valid profile updates, slow dismissal and late creation/show rejection. It rejects external traffic and checks each acknowledged native allocation's exact dismissal/destruction count, current visible views, provider receiver, mount marker, history identity and unhandled-error log.

## Final verification

- 180 new cases with 2,976 assertions and screenshots across Chromium 153 and native Firefox 153, development and production, at 390×568, 390×844 and 1280×844.
- 144 adjacent context-owner and overlay-owner cases with 2,154 assertions across both Chromium modes.
- Four final minimized green cases with 44 assertions. Total final browser scope: 328 cases and 5,174 assertions. Intentionally red baselines are excluded.
- Five added adapter regressions cover pre-cancelled admission, picture reclamation during held name creation and late name reclamation, late show rejection after local cancellation, dismissal reentry and synchronous show cancellation/rejection. All 13 overlay adapter tests pass.
- All 2,910 portal tests pass, with 93 explicitly skipped tests; 301 suites pass and 15 are skipped.
- 23 built-artifact browser tests pass across Jest, Reddit and the injected Facebook fixture.
- All six isolated target builds and the Devvit server build pass. YouTube uses its fixture build, which does not certify partner release acceptance.
- Types, target boundaries, security configuration, documentation (26,671 declarations) and file-size checks pass.
- The source freeze covers 2,459 selected inputs and six owned records with before/after hashes and a reversible diff. All 17 final tracked jobs terminate, including two intentionally red baseline runs.
- Existing backend/Firebase SDK authority evidence is reused only after confirming all 824 selected inputs and 24 compiled core copies remain byte-identical. Those integration suites were not freshly rerun for this client-only change; the changed native overlay adapter is freshly covered above.
- 1,301 output files, six isolated dependency inventories and the extra Facebook fixture inventory are preserved and hashed before exact owned temporary build roots/metadata are removed. Browser scratch directories are removed after their jobs terminate.

The first adapter preflight exposed two existing tests that assumed fixed promise-queue depth. Their SDK ports now expose explicit admission events; assertions continue to retire identity or surface only after the intended SDK operation starts. The first expanded fixture also allocated another synthetic view each time its release callback was invoked during teardown, even though its underlying promise had already settled. All 22 failed assertions concerned those extra fixture allocations. The release callback now models one SDK settlement, and the corrected 15-case preflight passes all 248 assertions. Both diagnostics are retained.

A later adapter regression exposed synchronous show reentry: checking only the whole show batch allowed the next show after cancellation. A per-show check stopped that call but could discard an earlier rejected promise when batch construction threw. The retained red rejection log demonstrates that failure. Observers are now installed before each deferred SDK invocation, and the final 13-test adapter preflight and browser matrices pass. No final source changed after the verification freeze.

Run `python3 artifacts/live-overlay-cancellation-2026-10-06/verify.py` from the repository root to verify source, runtime, authority, artifacts and cleanup. Firefox uses the native executable and does not claim Firefox MCP coverage. No visible production text, score/reward authority, commit or deployment changed. The full improvement goal remains active; the earlier multiplayer retirement callable/Devvit-route/TTL deployment prerequisite remains in force before releasing those clients.
