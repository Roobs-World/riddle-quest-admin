# Invitation confirmation retirement — 4 October 2026

Retired invitation acceptances now release their confirmation-read deadline promptly. The local cancellation does not declare the invitation unavailable or cancel the provider's promise. Active reads still require a matching, validated unavailable preview before showing the terminal invitation screen; other responses remain retryable.

## Reproduction and diagnosis

The actual `RaceTo10Game` invitation card first loads an available preview. Explicit acceptance starts the live journey, whose rejected join can request a second authoritative preview to determine whether the invitation is unavailable. Previously that second read allocated a separate 10-second local deadline without the mounted journey's cancellation signal.

The original browser loop held that confirmation, pressed native Escape and returned to the intro. One command deadline remained pending. Removing the subsequent replacement race and all typing preserved the failure:

```sh
pnpm_config_verify_deps_before_run=false LIVE_CONFIRM_QUICK=1 \
  LIVE_CONFIRM_SCENARIOS=close-minimal \
  LIVE_CONFIRM_REPORT_DIR=artifacts/live-confirmation-retirement-2026-10-04/red-minimal \
  node packages/portal/scripts/verify-live-confirmation-retirement-browser.mjs
```

The initial and minimized loops both failed the same timer assertion. Three hypotheses were recorded before controls: the secondary read lacked cancellation ownership, the probe accidentally counted an intro timer, or StrictMode caused the result. Production reproduced the retained deadline after close and provider replacement. The probe tracks only 2-second/10-second timers whose native allocation stack includes the real delivery helper; the intro's 8-second preview timer is excluded. Active unavailable, available, invalid and stable-parent controls passed. Giving the helper optional cancellation support alone left the actual close loop failing, confirming that caller wiring was also required.

## Change

`confirmUnavailableLiveInvitation` now accepts an optional retirement signal, declines to start a read if it is already aborted, and passes it to the existing bounded-delivery helper. `LiveRaceGame` supplies the existing journey signal. The helper returns false on local cancellation, preserves strict server-preview validation while active, and observes late adapter settlement without reviving the retired UI.

The implementation diff is three changed helper lines and one caller line. Three unit cases cover an already retired owner and pending confirmation cancellation followed by either a late success or failure. No visible copy or target SDK integration changed.

## Verification

The final original and updated production fixtures use identical scenario/viewport/assertion keys. The original survey fails fifteen retirement-deadline assertions out of 351; all remaining assertions pass. Updated development and production surveys each pass all 351 assertions. The timer probe must observe the expected live 10-second deadline before retirement, so missing instrumentation cannot produce a false pass.

| Check | Result |
| --- | --- |
| New injected browser journeys | 54 journeys / 702 assertions |
| React modes and viewports | Development StrictMode and production; 390×568, 390×844, 1280×844 |
| Retirement coverage | Native Escape, owner replacement, provider replacement/removal and late adapter failure |
| Active controls | Stable parent updates, matching unavailable confirmation, available/mismatched responses and successful retry |
| Join/update wait regressions | 1,260 assertions |
| Provider retirement regressions | 1,206 assertions |
| Callback lifetime regressions | 1,116 assertions |
| Total injected browser assertions | 4,284 |
| Targeted helper/deadline units | 40 passed |
| Portal unit suite | 2,727 passed in 296 suites; 121 optional browser tests skipped |
| Current built game journeys | 37 passed in seven suites |
| Types and documentation | Passed; 25,177 declarations documented across 1,138 files |
| Six target builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix candidate and Yahoo candidate passed |
| Source stability | Independently recollected 765-path source/build-input inventories and hashes match |

Native Firefox at 390×568 accepted the real invitation card and observed one held confirmation with a 10-second deadline. Escape returned to the intro, removed that deadline and left the provider receipt held. A fresh race typed `pian`; releasing the old unavailable preview preserved the same focused editor and draft, emitted no completion notification, and created no leave for the unaccepted invitation. Native `o` and Enter advanced the fresh race once to 1/10. All four raw observations were parsed and asserted with no browser error or unhandled promise.

The owned Firefox tab was closed, the original blank tab preserved, the fixture stopped and its scratch directory removed. Captured originals, failed loops, staged controls, screenshots, source diff, asserted production comparison, raw/asserted Firefox proof and verification summary are in `artifacts/live-confirmation-retirement-2026-10-04`. The new regression runs in the game browser verification chain.

These are controlled local adapter and resource measurements. No live provider latency or server cancellation claim is made. The broader reliability, performance, playability and latency goal remains active.
