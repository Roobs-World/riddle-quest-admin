# Version 22 Android Home/Recents recovery comparison — 28 November 2026

An ordinary Android Home/Recents cycle did **not restore observable app Quit** after Terms OPEN/Back in this unmodified, single-account session. Both Quit attempts returned enabled Settings controls and the unsaved warning; exit required separate host cleanup. This does not identify the cause or establish save completion. The [structured record](facebook-android-home-recovery-version-22-2026-11-28.json) retains exact observations and private-evidence hashes.

## Exact candidate and first Quit

Launch was recorded at **04:52:09.678682 UTC**. Rendered SDK Info at **04:52:32.415146** confirmed SDK **8.0**, version **22**, and `/instant-bundle/2143220529953108/27134874202877022/index.html`, with **47 advertised APIs** and no banner-load capability. No visible banner appeared. This is the unchanged [Testing artifact](facebook-testing-version-22-2026-11-28.json), source `3d1d2e43a8dcfec2d6cd401de4200609601e9f37`, archive SHA-256 `d1b55275070597cdc6478ecae7879d414bbc57eb499f5cb9f71515019a1074b6`. Gameplay remained GUITAR with five empty rows and **1,180 coins**.

Terms at **04:53:24.397508**, OPEN at **04:53:37.227229**, and Android Back at **04:53:49.088925** traversed the external Terms page. App Quit at **04:54:02.804541** showed disabled controls at **04:54:08.342665**. By **04:54:24.569037**, controls were enabled with the unsaved warning. An ordinary scroll exposed its complete text at **04:54:41.107789**: “Progress isn't saved yet. Keep the game open.”

## Home/Recents and retry

Android Home at **04:54:47.662453** was confirmed at **04:54:52.874772**. Recents at **04:55:03.633254** was confirmed at **04:55:13.263221**. Selecting the existing Facebook card at **04:55:20.917301** returned to the same Settings position and warning by **04:55:28.102817**, with **QuicksilverActivity** retained. No welcome screen or reload was observed. The Facebook shortcut already on Home was not created in this check.

App Quit retry at **04:55:37.427866** showed disabled controls and a cleared warning at **04:55:37.519907**. By **04:55:56.827019**, about **19.399 seconds** after the tap, Privacy, Terms and Quit were enabled and the full warning had returned. The same Quicksilver activity remained. A fresh bounded UI receipt at **04:56:18.107294** independently confirmed the three enabled controls and exact warning text. No app exit was observed.

## Cleanup and limits

Host X at **04:56:18.125685** opened a menu confirmed at **04:56:24.872488**. The host’s blue Quit at **04:56:30.572466** exited; fresh screenshot/activity inspection confirmed **FbMainTabActivity** at **04:56:45.011757**. Temporary device UI XML was removed at **04:56:45.610803**. This host cleanup is separate from either app-Quit attempt.

All timestamps are controller observations, not exact internal completion times. Only normal UI and rendered SDK Info were used: no JavaScript console, probe, SDK patch or synthetic lifecycle event. No gameplay progress, preference or consent change was made; automatic storage writes are not excluded, and no new-save persistence is proved. This single comparison does not establish a general host cause or universal Home/Recents behavior. Raw screenshots and device observations remain private.

The session is separate from the earlier [warning verification](facebook-settings-warning-rendering-2026-11-28.md), [served-banner observations](facebook-android-banner-version-22-2026-11-28.md) and [instrumented lock/lifecycle diagnostic](facebook-lock-lifecycle-diagnostic-version-22-2026-11-28.md). Source, artifact, Firebase and provider-server configuration remain unchanged. No build, upload, Production promotion, review submission or publication occurred. Full journey acceptance remains open; the 79-row API coverage classifications are unchanged.
