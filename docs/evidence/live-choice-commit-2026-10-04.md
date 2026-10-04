# Native friend selection follows committed provider ownership

A successful native friend selection could be discarded while the original multiplayer lobby was still visible. Rendering a replacement provider wrote `choiceProvider.current` before React committed that render. A suspended or abandoned render therefore invalidated the original chooser even though its lobby still owned the interaction.

`RaceTo10Game.tsx` now updates that ref in a layout effect. A suspended replacement preserves the original selection; a committed replacement updates ownership before promise continuations, including results released by a parent's layout effect. The existing chooser retirement and audience transport behavior remain covered.

## Reproduction and diagnosis

The minimal production command failed with exit 1 and one specific assertion: the original audience should have joined its reserved `mixed` seat, but `joins` was empty.

```sh
pnpm_config_verify_deps_before_run=false LIVE_CHOICE_QUICK=1 LIVE_CHOICE_SCENARIOS=speculative LIVE_CHOICE_REACT_MODE=production LIVE_CHOICE_REPORT_DIR=../../artifacts/live-choice-commit-2026-10-04/red-repeat pnpm --dir packages/portal exec node scripts/verify-live-choice-commit-browser.mjs
```

The harness mounts the actual `RaceTo10Game`, obtains its actual category catalog, opens its friend chooser, renders a sibling that suspends after the provider replacement renders, and releases the original chooser. It observes the retained lobby, exact audience join request and subsequent answer submission. Browser effects and provider promises are injected; React ownership logic and game components run unchanged.

Three ranked explanations were checked: an uncommitted provider-ref write, cancellation of the chooser lifetime, and loss of category selection. Unchanged-provider, normal cancellation and committed replacement controls passed before the fix. The final harness against the captured original component produced nine failures, all in suspended, abandoned or accepted-before-commit scenarios across three viewport sizes. Moving only the ref update to a layout effect removes those failures.

## Verification

| Check | Result |
| --- | --- |
| Chooser harness, development and production React | 732 assertions passed; 90 journeys across 15 scenarios and three viewports |
| Existing provider retirement harness, both React modes | 1,206 assertions passed |
| Firefox before/after | Original visible provider retained; original code discarded selection; fixed code joined exactly one reserved audience seat and native keys submitted `PIANO`, advancing to 1/10 |
| Firefox committed replacement | Result released during the parent commit created no retired seat; subsequent native Start joined provider 2 with one active subscription |
| Portal unit suite | 2,756 tests passed in 297 suites; 121 optional browser tests skipped in this command |
| Built-game browser suites | 37 tests passed in seven suites |
| Portal types | Passed |
| Documentation audit | 25,248 declarations across 1,139 files passed |
| Six target builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | All 766 inventoried source inputs identical before and after verification |

Chooser scenarios include abandoned and suspended replacements, both orderings of selection acceptance and replacement commit, account replacement, capability removal, unmount, 32 ordinary parent updates, cancellation, provider error, promise rejection, and stale errors released during replacement commit. Accepted audience seats remain playable and retire under their original provider when a later replacement commits. The verifier is registered as `test:live-choice-commit:browser` and included in the game browser chain.

Firefox observations are parsed and asserted in `firefox-verified.json`. Native text and Enter came from Firefox MCP; suspended rendering and provider responses were injected controls. The hidden answer input could not be clicked into view and focus measured false; this trace verifies the game's native keyboard handling and submission, and makes no input-focus claim. No live provider service or OS friend dialog was exercised.

YouTube used the incomplete, English content fixture; these checks do not establish release-content completeness. This pass fixes multiplayer selection reliability and playability and makes no measured network latency claim. The broader improvement goal remains active.

Artifacts: [verification summary](/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-choice-commit-2026-10-04/verification-summary.json), [exact owned diff](/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-choice-commit-2026-10-04/owned-source.diff), and [Firefox observations](/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-choice-commit-2026-10-04/firefox-verified.json). Captured original and final source, baseline observations, browser observations, build logs and gate logs are in the same artifact directory. Owned fixture processes were interrupted after cleanup (pnpm reported exit 130); both scratch directories were removed and Firefox's original blank tab was preserved.
