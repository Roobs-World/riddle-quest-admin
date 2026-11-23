# Game music follows committed settings and lifetime

The game audio hook published mute and pause settings during rendering. When an unmute or resume render suspended, a native key could start the actual bundled track while the visible game still reported muted or paused. Conversely, a speculative mute/pause could prevent the still-active visible game's next gesture from resuming its media element. Playback stop work ran in a passive effect, leaving music active during parent layout callbacks after mute, pause or removal. In Chromium, the removed media element could continue playing afterward.

Audio gestures now read committed settings. Media state changes and cleanup run during commit, capturing the actual element so React ref detachment cannot leave playback running. Preference persistence remains passive and depends only on mute changes. Gestures skip hidden documents and already-playing media; rejected playback remains retryable because a paused element can receive a later gesture.

## Diagnosis

The original minimal reproduction failed two of eight checks. The final captured-source replay uses the expanded twelve-check scenario with positive controls for committing the prepared setting:

```sh
pnpm_config_verify_deps_before_run=false AUDIO_COMMIT_REACT_MODE=production AUDIO_COMMIT_QUICK=1 AUDIO_COMMIT_SCENARIOS=spec-unmute AUDIO_COMMIT_BASELINE_DIR=../../artifacts/game-audio-commit-2026-10-04 AUDIO_COMMIT_REPORT_DIR=../../artifacts/game-audio-commit-2026-10-04/red-final pnpm --dir packages/portal exec node scripts/verify-game-audio-commit-browser.mjs
```

The fixture uses the actual reducer and audio hook with the bundled WebM/Opus track. A native Prepare click starts a toggle while a sibling suspends its commit. Owner A remains visibly muted; a native Backspace nevertheless calls `play()` and advances actual media time. The ranked explanations were render-time setting publication, delayed media stop work, and redundant playback paths. Publishing only committed settings fixes suspended settings but leaves five failures in the 68-check probe: committed mute/pause, retirement timing/continuation, and redundant playback calls. Committed media cleanup plus paused-media admission resolves them.

The final original-source matrix fails 45 of 273 assertions. Both fixed React modes pass all 273 each across ten scenarios and three viewports. Prepared toggles are applied once; positive controls verify the selected settings commit and govern real playback after the next native key.

## Verification

| Check | Result |
| --- | --- |
| New real-media audio harness, both React modes | 546 assertions passed across 60 journeys |
| Existing real solo/live keyboard lifetime harness, both modes | 376 assertions passed |
| Firefox original/fixed suspended unmute | Native Prepare click and Backspace; visible muted A starts actual playback before the fix, remains paused with zero play calls after it |
| Firefox original/fixed retirement | Native Unlock and Retire clicks; original parent layout sees detached audio still playing, fixed parent layout sees it paused |
| Playback call work | 32 native Backspaces and eight feedback clicks issue 48 extra `play()` calls before the fix and zero after it; music stays playing |
| Rejected-playback control | An injected first denial remains paused; the next trusted gesture plays the actual track without an unhandled rejection |
| Hidden-document control | Injected hidden state prevents a native-key playback request and keeps paused media paused |
| Portal unit suite | 2,756 tests passed in 297 suites; 121 optional browser tests skipped |
| Built browser journeys | 38 tests passed in eight suites, including actual bundled music starting on the first Play tap |
| Types and TSDoc | Passed; 25,273 documented declarations across 1,139 files |
| Six builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Source stability | All 766 inventoried source inputs identical before and after verification |

The matrix covers speculative unmute/resume/mute/pause, committing each prepared setting, immediate committed mute/pause, removal, native key/feedback work across 32 parent updates, playback denial recovery and hidden-document admission. Media methods are counted while delegating to native browser playback, except the explicitly injected first denial. The real-media fixture sets volume to zero to keep verification quiet. DOM settings, media `paused`, positive playback time and native gestures are observed independently. Parent layout observations use actual React callbacks rather than delayed reads.

Firefox automatically pauses a detached element after the parent layout callback; Chromium's original detached playback continues. The fix establishes explicit cleanup before that callback in both browsers. An initial Firefox check assumed Chromium's later detached state; the trace was re-read and asserted against Firefox's actual behavior. That platform difference does not change the captured commit-window defect or fix.

The verifier is registered as `test:game-audio-commit:browser` in the game browser chain. Preference storage remains separate from media lifetime, and pause-only changes no longer repeat mute persistence. No visible product copy changed. Provider isolation and server-authoritative economy/identity/scoring remain unchanged. Counts measure native playback API work, not elapsed latency or heap bytes. YouTube uses incomplete English fixture content, so release-content completeness is unverified. The broader improvement goal remains active.

Both owned Firefox servers stopped with exit 130 and their exact scratch directories were removed. Four owned tabs were closed, preserving the original blank tab. Serve-only shutdown output with zero automated checks is not counted as verification.

Evidence: [verification summary](../../../../artifacts/game-audio-commit-2026-10-04/verification-summary.json), [owned source diff](../../../../artifacts/game-audio-commit-2026-10-04/owned-source.diff), and [asserted Firefox traces](../../../../artifacts/game-audio-commit-2026-10-04/firefox-verified.json). Original/final source, the isolated committed-settings probe, screenshots, observations and gate logs are retained in the artifact directory.
