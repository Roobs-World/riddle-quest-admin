# Hosted bridge callbacks follow committed renders

The visible single-player game could submit an answer through an authority adapter from an unfinished render. The host bridge kept its DOM subscriptions stable but assigned its router, lifecycle sender, notice sink, account guard and recovery callback refs during render. A suspended or abandoned replacement therefore changed the callbacks used by the still-visible host.

`useHostBridgeLifecycle` now updates those five refs together in a layout effect. A committed replacement becomes available before subsequent browser events and promise continuations. Unfinished renders preserve the visible host's callbacks. Account ownership remains checked against the originating authentication visit, including identity notifications that precede React rendering.

## Reproduction and diagnosis

This minimal production command failed with exit 1: the visible host remained A, but the actual hosted game's answer was submitted through B.

```sh
pnpm_config_verify_deps_before_run=false HOST_COMMIT_QUICK=1 HOST_COMMIT_SCENARIOS=speculative HOST_COMMIT_REACT_MODE=production HOST_COMMIT_REPORT_DIR=../../artifacts/host-bridge-commit-2026-10-04/red pnpm --dir packages/portal exec node scripts/verify-host-bridge-commit-browser.mjs
```

The regression mounts the actual `PlayHostApp` with two target-neutral hosted authority adapters sharing the same authentication provider. A sibling suspends after replacement B renders. Physical keys and Submit then cross the game's real local bridge and command router. The test observes the still-visible A host, actual service invocation and authoritative keyboard feedback. The provider services are injected; the hosted game, session assembly, bridge and command ownership logic run unchanged.

Three ranked explanations were checked: the render-written router ref, mutation of shared authority services, and an unnoticed B commit. Suspended and abandoned controls reproduced across three viewport sizes; the committed replacement control correctly used B. Firefox independently retained the original board and A host while the original code submitted `ZZZZZ` through B. Moving only the bridge ref assignments to a layout effect fixed the routing failure. The final comprehensive harness against the captured original hook reproduced 30 assertions involving unfinished routing, lifecycle delivery, notices, recovery and ownership guards.

## Verification

| Check | Result |
| --- | --- |
| New bridge commit harness, both React modes | 480 assertions passed; 78 journeys across 13 scenarios and three viewports |
| Existing host ownership harness, both modes | 232 assertions passed, including identity replacement before rendering and SDK registration/cleanup failures |
| Firefox before/after | Actual native `ZZZZZ` plus Submit used B before the fix and A after the fix while visible host A and the board were retained |
| Firefox committed replacement | After B committed, native `XXXXX` plus Submit used B; the original board remained mounted and the two submissions had distinct request identities |
| Portal unit suite | 2,756 tests passed in 297 suites; 121 optional browser tests skipped in this command |
| Built-game browser suites | 37 tests passed in seven suites |
| Portal types | Passed |
| Documentation | 25,248 declarations across 1,139 files passed |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | All 766 inventoried source inputs unchanged across verification |

The extended harness uses the actual host bridge hook, actual authentication hook and schema-validating router to cover SDK pause/resume, document visibility, delayed errors, validation recovery, removed recovery callbacks, a speculative guard replacement and 32 ordinary parent updates. Callback updates preserve the same bridge and visibility subscriptions. The existing ownership harness confirms that an actual account notification still retires old commands, notices and telemetry before a replacement render commits. The new verifier is registered as `test:host-bridge-commit:browser` in the game browser chain.

Firefox used native keys and observed Submit buttons; suspended renders and authority adapters were injected. Observations were parsed and asserted before saving. No live provider network or purchase flow was exercised. YouTube used the incomplete English content fixture, so these checks do not prove release-content completeness. This pass improves command reliability; it makes no measured network latency claim. The broader improvement goal remains active.

Evidence: [verification summary](/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-bridge-commit-2026-10-04/verification-summary.json), [exact owned source diff](/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-bridge-commit-2026-10-04/owned-source.diff), and [Firefox observations](/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-bridge-commit-2026-10-04/firefox-verified.json). Original/final source captures, baseline observations, browser results and all build/gate logs are alongside these files. Owned fixture processes cleaned up before termination (pnpm reported exit 130); both scratch directories were removed and the original Firefox blank tab was preserved.
