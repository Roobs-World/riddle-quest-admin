# Abandoned provider updates preserve multiplayer panels

Four multiplayer wrappers stored their provider/selector lifetime and child key in mutable references during rendering. Preparing a replacement could change those references while the original panel remained visible. Abandoning the replacement initially preserved that panel, but the next ordinary parent update compared the visible props against the discarded replacement's metadata and remounted the original panel.

That remount erased recipients and safety categories, discarded pending or confirmed action presentation, and removed loaded inbox or network preview rows while starting another read. Cached previews also lost their DOM identity unnecessarily.

The wrappers now keep their lifetime tuple in React state. Conditional render updates align each tuple with its existing provider and selector fields; React isolates those updates with the render that owns them. A committed replacement still receives a fresh keyed panel immediately, while an abandoned replacement cannot change the visible panel's future key. Inner authority validation, immutable retry intents, local deadlines and server-owned mutation rules remain in the existing panels.

## Diagnosis

The abandonment-only probe passed. Adding the next ordinary parent update produced a minimal reproduction failing two of seven checks:

```sh
pnpm_config_verify_deps_before_run=false PANEL_COMMIT_REACT_MODE=production PANEL_COMMIT_QUICK=1 PANEL_COMMIT_KINDS=direct-input PANEL_COMMIT_CHANGES=abandon PANEL_COMMIT_BASELINE_DIR=../../artifacts/live-panel-commit-2026-10-04 PANEL_COMMIT_REPORT_DIR=../../artifacts/live-panel-commit-2026-10-04/red pnpm --dir packages/portal exec node scripts/verify-live-panel-commit-browser.mjs
```

Native input prepares `Rival`. A native Prepare click starts a provider replacement whose sibling suspends. Native Abandon retains Alice's editor and text. Native Update parent then replaces that editor and clears its recipient before the fix. The ranked explanations were discarded render metadata changing the lifetime key, ordinary parent updates clearing input, and promise settlement retiring the panel. Stable-update controls and the case without a pending operation distinguish those alternatives.

Repairing only the direct-invite wrapper makes its three abandonment scenarios pass. The 72-check intermediate probe retains 19 failures in safety, inbox and preview panels, identifying the same ownership pattern in those wrappers. Repairing all four resolves the complete matrix: the captured original fails 87 of 603 production assertions; both fixed React modes pass all 603 each.

## Verification

| Check | Result |
| --- | --- |
| New panel lifetime harness, both React modes | 1,206 assertions passed across 162 journeys |
| Existing inbox harness, both modes | 100 saved assertions passed |
| Existing cached/network preview harness, both modes | 132 saved assertions passed |
| Existing direct-invite recovery harness | 34 saved assertions passed |
| Existing block/report recovery harness | 40 saved assertions passed |
| Firefox original/fixed recipient | Native fill, Prepare, Abandon and Update parent; original editor is replaced and cleared, fixed editor remains identical with `Rival` intact |
| Firefox retained direct action | Native Send dispatches once through Alice with the retained recipient; native authority release produces one queue confirmation |
| Firefox original inbox | Immediately before Update parent, Alice's row is loaded; afterward its node is gone and one extra read is held |
| Firefox fixed inbox | Same loaded row survives the full sequence; native Accept delivers Alice's selected invitation once |
| Portal unit suite | 2,756 tests passed in 297 suites; 121 optional browser tests skipped |
| Built browser journeys | 37 tests passed in seven suites |
| Types and TSDoc | Passed; 25,275 documented declarations across 1,139 files |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | All 766 inventoried source inputs identical before and after verification |

The matrix exercises the actual LiveRaceDirectInvite, LiveRaceSafety, LiveRaceInbox and LiveRaceInvitationCard components under React StrictMode. Nine panel states cover editable recipients, pending and confirmed direct actions, selected/pending/confirmed safety actions, loaded inbox rows and network/cached previews. Each state tests an abandoned replacement followed by a parent update, a committed replacement, and eight ordinary parent updates. Native controls select recipients and reasons, issue actions, prepare/abandon/commit replacements, release injected authority receipts and accept invitations. Provider callbacks and validated responses are fixture adapters rather than live provider services.

Original production inbox and network-preview abandonment cases each start an extra read. Holding that unnecessary response demonstrates the loss of already loaded acceptance controls; fixed cases keep those controls and issue zero extra reads. Committed replacements still start their own reads and mutations and show only their own validated results. These counts measure avoidable requests and panel replacement, not production network latency or heap allocation.

An initial Firefox inbox trace spanned normal polling and timeout windows, making its total read count unsuitable for measuring a single remount. The corrected original trace resets the read baseline and holds responses immediately before the final parent update. The fixed Firefox trace verifies DOM continuity and explicit acceptance; the controlled Chromium matrix separately proves zero extra reads. Only asserted traces are saved as verification evidence.

The React review checks conditional state alignment, lazy initialization, existing ownership selectors, unchanged public interfaces, target adapter use and accessible controls. No visible product copy changed. The verifier is registered as `test:live-panel-commit:browser` in the game browser chain. YouTube uses incomplete fixture content, so release-content completeness remains unverified. The broader improvement goal remains active.

Both owned Firefox servers stopped with exit 130 and their exact scratch directories were removed. Four owned tabs were closed, preserving the original blank tab. Serve-only shutdown output with zero automated checks is excluded from assertion totals. Existing regression reports use separate directories inside this pass's artifact directory.

Evidence: [verification summary](/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-panel-commit-2026-10-04/verification-summary.json), [owned source diff](/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-panel-commit-2026-10-04/owned-source.diff), [asserted Firefox traces](/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-panel-commit-2026-10-04/firefox-verified.json), and [React review](/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-panel-commit-2026-10-04/react-review.json). Captured source, observations, screenshots, inventories and gate logs are retained in the artifact directory.
