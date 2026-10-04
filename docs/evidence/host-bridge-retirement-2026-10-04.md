# Host subscriptions retire during commit

The hosted game could still admit a queued answer after React removed its DOM, before passive cleanup detached the bridge listener. Old SDK pause/resume callbacks could also deliver into a committed replacement provider during that gap.

`useHostBridgeLifecycle` now gives each committed lifecycle subscription group an ownership token. Layout cleanup retires it synchronously; every bridge entry, schema-parser continuation, error callback and lifecycle delivery checks that exact token. Passive cleanup still removes listeners and observes SDK cleanup failures. Ordinary callback changes retain the current subscription group; a new committed lifecycle replaces it. StrictMode replay receives a fresh token and cannot revive callbacks from an earlier group.

## Reproduction and diagnosis

The actual `PlayHostApp` first submits native `ZZZZZ` normally. Removing it triggers a parent's layout effect that dispatches a schema-valid queued `XXXXX` with a distinct mutation identity. The parent records that the game DOM is gone while the old bridge listener is still attached. The original bridge calls the authority adapter twice; the fixed bridge admits only the explicit first submission.

This final minimal command fails with exit 1 against the captured original source, with one extra authority-adapter call:

```sh
pnpm_config_verify_deps_before_run=false HOST_RETIRE_QUICK=1 HOST_RETIRE_SCENARIOS=hosted HOST_RETIRE_BASELINE_DIR=../../artifacts/host-bridge-retirement-2026-10-04 HOST_RETIRE_REACT_MODE=production HOST_RETIRE_REPORT_DIR=../../artifacts/host-bridge-retirement-2026-10-04/red-final pnpm --dir packages/portal exec node scripts/verify-host-bridge-retirement-browser.mjs
```

Three ranked explanations were checked: subscription activity surviving until passive cleanup, an invalid authority replay, and the host still being mounted. The minimized reproduction uses the real game, real hosted session assembly and real schema-validating bridge. DOM/listener observations establish the removal boundary. An independent schema-valid ready-command case reproduces without gameplay authority; the lifecycle case reproduces with SDK and visibility signals. The speculative and callback-only commit controls remain usable. Original production code failed 18 assertions across three viewports; the ownership-token change removes those failures.

An initial fixture replay reused the first mutation identity and demonstrated a redundant adapter call, without establishing another accepted score. The final fixture and matching Firefox comparison use a distinct queued identity and `XXXXX`; the evidence still claims adapter invocation rather than acceptance by a live backend. Server idempotency and mutation authority remain unchanged.

## Verification

| Check | Result |
| --- | --- |
| New retirement harness, development and production React | 372 assertions passed; 54 journeys across nine scenarios and three viewports |
| Prior committed-callback harness, both modes | 480 assertions passed |
| Existing host account/SDK ownership harness, both modes | 232 assertions passed |
| Firefox native before/after | Native `ZZZZZ` and Submit worked in both; the queued `XXXXX` reached the original adapter after removal and was blocked by the fixed bridge |
| Firefox phase proof | Parent layout saw removed game DOM and one old listener; afterward the listener count was zero, with no browser errors or unhandled promises |
| Portal unit suite | 2,756 tests passed in 297 suites; 121 optional browser tests skipped in this command |
| Built-game browser suites | 37 tests passed in seven suites |
| Portal types | Passed |
| Documentation | 25,252 declarations across 1,139 files passed |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | All 766 inventoried source inputs identical before and after verification |

The retirement harness covers actual hosted answer delivery, warm validated commands, SDK/document lifecycle signals, held error and validation-recovery promises, provider replacement during parent layout, callback-only commits, suspended replacement and remount with retained old SDK callbacks. Existing ownership regressions preserve account retirement before rendering, current pending errors, registration failure isolation and cleanup failure isolation. The verifier is registered as `test:host-bridge-retirement:browser` in the game browser chain.

The fix rejects work entering a retired subscription; it does not cancel authority operations already admitted before removal. Firefox keys and Submit/Retire clicks were native browser interactions. The queued command and provider events were injected controls. No live provider backend was exercised. YouTube uses the incomplete English content fixture, so release-content completeness remains unproven. This pass improves lifecycle reliability and avoids stale adapter delivery; it makes no measured network latency claim. The broader improvement goal remains active.

Evidence: [verification summary](/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-bridge-retirement-2026-10-04/verification-summary.json), [exact owned source diff](/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-bridge-retirement-2026-10-04/owned-source.diff), and [asserted Firefox observations](/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-bridge-retirement-2026-10-04/firefox-verified.json). Source captures, original/final browser results, build logs and gate logs are in the same directory. All owned fixture processes stopped after cleanup (pnpm reported exit 130), all three scratch directories were removed, and Firefox's original blank tab was preserved.
