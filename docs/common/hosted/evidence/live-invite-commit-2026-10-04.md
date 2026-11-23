# Native invitations follow the committed lobby

LiveRaceInviteShare updated its invitation owner reference during rendering. A suspended provider, challenge or fallback-sharing replacement could therefore redirect the still-visible lobby's native button to the unfinished replacement. A pending dialog failure could also lose its retry notice when a speculative render or an abandoned replacement changed that owner reference.

Each rendered invitation visit now has a stable identity. A layout effect publishes that identity to native actions and pending dialog outcomes only when the lobby commits. Feedback rendering compares against the rendered visit's identity, so committing a replacement hides prior-lobby errors immediately. A still-open native dialog continues to exclude another dialog until its original promise settles.

## Diagnosis

The minimal original-source reproduction failed one of six checks:

```sh
pnpm_config_verify_deps_before_run=false INVITE_COMMIT_REACT_MODE=production INVITE_COMMIT_QUICK=1 INVITE_COMMIT_SMOKE=1 INVITE_COMMIT_SCENARIOS=spec-transport INVITE_COMMIT_BASELINE_DIR=../../artifacts/live-invite-commit-2026-10-04 INVITE_COMMIT_REPORT_DIR=../../artifacts/live-invite-commit-2026-10-04/red pnpm --dir packages/portal exec node scripts/verify-live-invite-commit-browser.mjs
```

A native Prepare replacement click suspends Bob's rendering while Alice's lobby remains visible. Clicking the real Challenge a friend button records a Bob callback before the fix. The ranked explanations were render-time owner publication, a retained stale button handler and incorrect sharing-capability precedence. Separate transport, challenge and context-fallback cases identify unfinished owner publication. Committed replacement controls verify that Bob's next native click correctly selects Bob after the replacement actually commits.

Publishing a stable owner only during commit resolves wrong dispatch and dropped pending feedback. The intermediate 110-check probe retains one failure: a newly committed lobby still displays the old lobby's existing error because feedback rendering reads the reference before its layout update. Comparing rendered feedback with the rendered visit identity resolves that final failure.

The complete captured-original production matrix fails 18 of 330 assertions at three viewports. Both fixed React modes pass all 330 each across twelve scenarios. Those cover suspended transport/challenge/fallback changes; pending failure, rejection, cancellation and success; committed replacement with a dialog pending; 32 ordinary parent updates; retirement; abandoning a speculative replacement; and hiding an existing error when a replacement commits.

## Verification

| Check | Result |
| --- | --- |
| New invitation ownership harness, both React modes | 660 assertions passed across 72 journeys |
| Existing native audience chooser ownership harness, both modes | 732 assertions passed |
| Existing live provider retirement harness, both modes | 1,206 assertions passed |
| Existing native invite locking/retry harness | 66 saved assertions passed, plus direct callback-argument and button-geometry checks |
| Firefox original/fixed native selection | Native Prepare and Challenge clicks; visible Alice opens Bob before the fix and Alice afterward |
| Firefox original/fixed pending failure | Native Share, Prepare and Settle clicks; Alice's still-visible lobby loses its notice before the fix and shows the existing translated retry notice afterward |
| Firefox committed replacement | Native Commit hides Alice's previous error; the next Challenge click invokes Bob |
| Portal unit suite | 2,756 tests passed in 297 suites; 121 optional browser tests skipped |
| Built browser journeys | 37 tests passed in seven suites |
| Types and TSDoc | Passed; 25,275 documented declarations across 1,139 files |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | All 766 inventoried source inputs identical before and after verification |

The fixture mounts the actual LiveRaceInviteShare and ReferralSharingProvider under React StrictMode. A sibling suspends the prepared replacement; native fixture buttons prepare, commit or abandon it. Native share callbacks are injected target-adapter functions with controlled promises, outcomes and one rejection. The actual component owns dialog exclusion, callback selection, retirement and translated feedback. Provider calls, visible lobby identity, disabled state, errors and unhandled promises are observed independently. These are controlled concurrency traces rather than live provider SDK dialogs or measured production network latency. The invite action creates no multiplayer seat in the fixture.

The verifier is self-contained and registered as `test:live-invite-commit:browser` in the game browser chain. No visible product copy changed. YouTube uses incomplete fixture content, so release-content completeness remains unverified. The broader improvement goal remains active.

Both owned Firefox servers stopped with exit 130 and their exact scratch directories were removed. Four owned tabs were closed, preserving the original blank tab. Serve-only shutdown output with zero automated checks is excluded from verification totals. Existing regression reports use separate directories inside this pass's artifact directory.

Evidence: [verification summary](../../../../artifacts/live-invite-commit-2026-10-04/verification-summary.json), [owned source diff](../../../../artifacts/live-invite-commit-2026-10-04/owned-source.diff), and [asserted Firefox traces](../../../../artifacts/live-invite-commit-2026-10-04/firefox-verified.json). Captured original/fixed and intermediate source, observations, screenshots, source inventories and gate logs are retained in the artifact directory.
