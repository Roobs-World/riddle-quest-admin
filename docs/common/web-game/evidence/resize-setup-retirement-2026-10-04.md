# Resize setup cannot outlive synchronous host retirement

The readiness reporter sends an initial viewport message before registering its native resize listener and body observer. If that host sender synchronously removes or replaces the game, React cleanup runs before those resources exist. The old setup then resumes and allocates a listener and observer that its completed cleanup can never release. Existing ownership guards prevent stale messages, but the orphaned resources still retain callbacks and receive browser work.

`useGameReadyReporter` now rechecks its active state and exact committed resize owner after initial viewport delivery, before allocating either resource. A normal mounted reporter still installs one listener and observer. A retired setup returns immediately; replacement and remount install only their fresh resources.

## Reproduction and diagnosis

The fixture mounts the actual readiness hook with native animation frames and a wrapped native `ResizeObserver`. A native Start click mounts game A. Its first viewport sender uses React `flushSync` to commit removal or replacement before returning. The original removal trace records no game and zero resize resources inside the sender, then one listener and one observer after setup resumes. That reproduces in Chromium and Firefox without browser errors.

The minimal original-source command exited 1 with two failures among eight checks: resource counts were one listener/observer instead of zero, both after setup and after final removal.

```sh
pnpm_config_verify_deps_before_run=false RESIZE_SETUP_REACT_MODE=production RESIZE_SETUP_QUICK=1 RESIZE_SETUP_SCENARIOS=retire RESIZE_SETUP_REPORT_DIR=../../artifacts/resize-setup-retirement-2026-10-04/red pnpm --dir packages/portal exec node scripts/verify-resize-setup-retirement-browser.mjs
```

The ranked explanations were setup continuing after host retirement, cleanup preceding allocation, and a replacement game owning the resources. The removal DOM trace rules out a current reporter; the zero-then-one resource trace identifies allocation after cleanup. Adding only the ownership recheck removes all 21 original-source failures across 120 assertions. The replacement control originally leaves two resource pairs and one pair after Stop; remount also accumulates a second pair. The fix retains exactly one current pair and releases both resources on final removal.

## Verification

| Check | Result |
| --- | --- |
| New setup-retirement harness, both React modes | 240 assertions passed; 30 journeys across five scenarios and three viewports |
| Existing readiness and resize cadence harness, both modes | 120 assertions passed |
| Prior committed-readiness harness, both modes | 276 assertions passed |
| Prior completion-listener retirement harness, both modes | 564 assertions passed |
| Firefox original/fixed removal | Native Start clicks; original allocated a resource pair after removal, fixed allocated none |
| Firefox fixed remount and replacement | Exactly one current listener/observer; native Stop released both |
| Portal unit suite | 2,756 tests passed in 297 suites; 121 optional browser tests skipped |
| Built browser journeys | 37 tests passed in seven suites |
| Types and TSDoc | Passed; 25,258 documented declarations across 1,139 files |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | All 766 inventoried source inputs identical before and after verification |

The new regression covers synchronous removal, synchronous sender replacement, remount, ordinary live setup and 32 parent updates. It asserts actual initial viewport geometry, current resource counts, complete final cleanup, and no messages after a later viewport change. Existing regressions preserve retry cadence, resize deduplication, callback independence, suspended initialization, committed sender retirement and immediate completion delivery. It is registered as `test:resize-setup-retirement:browser` in the game browser chain.

The fixture injects synchronous removal/replacement into the host callback using `flushSync`; it uses the real hook and browser resources, rather than the full game or a live provider host. The evidence establishes a resource leak at that callback boundary, without claiming duplicate authority operations, measured memory bytes, CPU timing or improved network latency. No visible product copy changed. YouTube uses incomplete English fixture content; release-content completeness remains unverified. The broader improvement goal remains active.

Both owned Firefox fixtures stopped after tab cleanup (pnpm exit 130), their exact scratch directories were removed, and a host process audit found no matching verifier process. Three owned tabs were closed across original/fixed checks, preserving the original blank tab. Serve-only shutdown output with zero automated checks is not counted as verification.

Evidence: [verification summary](../../../../artifacts/resize-setup-retirement-2026-10-04/verification-summary.json), [owned source diff](../../../../artifacts/resize-setup-retirement-2026-10-04/owned-source.diff), and [asserted Firefox traces](../../../../artifacts/resize-setup-retirement-2026-10-04/firefox-verified.json). Original/final source captures, observations and gate logs are retained in the same artifact directory.
