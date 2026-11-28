# Version 19 Android timer-delivery investigation — 28 November 2026

These diagnostic sessions used Testing **19**, bundle **29691804297082520**, on Galaxy S22, Android 16/API 36, Facebook 588.0.0.42.55. The [acceptance record](facebook-testing-version-19-2026-11-28.json) binds the artifact to source `1abd5c9fc09e59868e5651456a5fe2abaf99e048`. This investigation is separate from the [initial uninstrumented check](facebook-android-version-19-2026-11-28.md).

## First comparison and measurement limits

SDK Info at **02:42:51.348753 UTC** confirmed the exact bundle and 48 APIs, including `loadBannerAdAsync`. IGDebug's console remained open during these observations. Durations are milliseconds from each probe's start.

| Observation | Microtask | Animation frame | Ten-second timer | Measurement limit |
| --- | ---: | ---: | ---: | --- |
| Welcome baseline, start 02:43:13.428 | 7 | 13 | 10,004 | Console-output receipt at 02:43:35.327297. |
| Settings after Terms, start 02:44:58.635 | 16 | 21 | No matching output found | Missing output is not proof that a callback did not run. |
| Settings after Terms, owned diagnostic record, start 02:48:22.113 | 17 | 20 | `null` at elapsed 22,495 | Direct record inspection at 02:48:44.608, followed by cancellation/deletion. |

Terms at **02:43:49.289**, then **OPEN** at **02:43:59.399**, displayed Riddle Quest Terms on `roobsworld.com`. Android Back at **02:44:11** returned to the game. Welcome versus Settings confounds this first comparison.

The initial post-Terms UI extraction omitted the frame message. Later inspection and a DOM read at **02:47:20.527** found its **21 ms** result. Absent extracted logs, including earlier version 18 observations, cannot establish callback absence. At **02:46:58.159**, the game reported visible, paused `true`, no busy action, and a banner wrapper with null reservation and no inert flag.

The owned record's ten-second callback had not populated it after **22.495 seconds**, while its microtask/frame had. The timer was cancelled and record deleted. This measures delayed timer delivery, not its native cause or host-wide suspension.

## Pending Quit and explicit host exit

Settings Quit at **02:49:07.583** remained busy at **02:50:57.424**. The DOM reported visible, paused `false`, busy **Quit game**, banner present/reservation null/inert false, and no diagnostic record. Timer/frame functions had native-looking representations; these do not prove scheduling behavior.

Source places [native-dialog guards](../../../platforms/web/facebook/src/FacebookSdkDialogGate.ts) before the [15-second Quit preparation deadline](../../../platforms/web/facebook/src/engagement/FacebookPlayerSettingsActions.ts). A banner guard can wait before that deadline starts. Busy Quit identifies no awaited stage; guards, save, presence and native-Quit invocation were untraced.

Host **X** at **02:51:48**, then host **Quit** at **02:51:59**, reached `FbMainTabActivity` by **02:52:08**. This was an explicit host exit, not app-Quit recovery. The temporary device UI XML was removed.

## Controlled Settings comparison

A fresh launch at **02:53:02** had exact version 19/48 APIs/banner load confirmed at **02:54:25.718615**. A banner visibly rendered below IGDebug in Settings around **02:55**, without advertiser interaction.

| Same-session Settings probe | Start / record read UTC | Elapsed | Microtask | Frame | Ten-second timer |
| --- | --- | ---: | ---: | ---: | ---: |
| Before Terms | 02:56:23.108 / 02:56:53.623 | 30,515 | 7 | 10 | 10,002 |
| After Terms, before any app Quit | 02:58:51.307 / 02:59:15.261 | 23,954 | 15 | 17 | `null` |

Between probes, Terms at **02:57:23.384** and **OPEN** at **02:57:29.240** displayed the legal page; cookies remained unchanged. Android Back at **02:57:40** restored enabled, full-height Settings without a visible banner. Both record reads reported visible; each probe's record/callbacks were deleted/cancelled. The after receipt was captured at **02:59:24.426943**.

This reproduces timer nondelivery within the Terms-open/return workflow from Settings, independently of app Quit. Banner hiding and lifecycle transitions remain possible contributors; the underlying cause is not isolated. Frame callbacks completed in both probes. Host **X** at **02:59:30**, then host **Quit** at **03:00:02**, reached `FbMainTabActivity` by **03:00:07**. No app Quit was tested in this paired session. Device UI XML was removed; the phone was left outside the game with no active probes.

## Documentation and scope

Meta's [Debugging Tool documentation](https://developers.facebook.com/documentation/games/build/zero-permissions/debugging-tool) does not state that opening JS Console pauses timers, frames, rendering or lifecycle. Restrictions concern static SDK-script loading and the embedded local-development player; it does not guarantee zero interference.

Private paired receipts are `/tmp/riddle-quest-v19-settings-before-result.json` and `/tmp/riddle-quest-v19-settings-after-result.json`; identity is in `/tmp/riddle-quest-v19-settings-pair-sdk-info.json`. Earlier redacted receipts use the same prefix with `scheduler2-sdk-info`, `baseline2-scheduler-result`, `afterterms-dom-result`, `afterterms-dom-scheduler-read`, `owned-scheduler-result` and `quit-dom-result`, each ending `.json`. No raw XML, launch secrets or feed images are included. Source, artifact and Testing assignment remained unchanged; no build/upload, Firebase/configuration, preference, reward or social-send change occurred. No support report was sent.
