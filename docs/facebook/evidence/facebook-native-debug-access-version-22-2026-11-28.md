# Version 22 native debug access — 28 November 2026

The planned dedicated-Worker lock query **did not execute**. Facebook's process changed during launch and the replacement exposed no observed WebView debug socket; the cause is unknown. This phase records loss of diagnostic access, ordinary gameplay/settings observations and a successful **no-Terms** app Quit. It is **not** a rejected Worker/query, a lock inventory or a reproduction/fix of the [earlier Terms failure](facebook-android-gate-stage-diagnostic-version-22-2026-11-28.md). The [structured record](facebook-native-debug-access-version-22-2026-11-28.json) retains safe observations and 12 private-evidence hashes.

## Android access and candidate

Before the fresh launch at **06:41:09.128842 UTC**, the original Facebook process and its debug socket had been observed. After launch, a different process was present and no replacement debug socket was observed. The old owned ADB forward was removed. A main-document queue snapshot attempt failed at HTTP transport, **before CDP connection**, so it read no queues. The JS Console UI opened blank at **06:45:21.772890**; no command was entered or JavaScript executed, and no debug socket appeared.

The rendered debug menu separately showed **SDK 8.0** at **06:44:22.379337**. SDK Info at **06:46:50.220681** confirmed [Testing version 22](facebook-testing-version-22-2026-11-28.json), `/instant-bundle/2143220529953108/27134874202877022/index.html`, and **48 advertised APIs**, including banner load. The helper's fixed SDK-version field is not used as the separate version observation.

The private Worker harness was syntax-checked and independently reviewed, with SHA256 `e4fa370b2c4cf04d55678192f1e100f3bee8023824b581087c0d488c1a439cf8`. It was **not run**: no Worker was created, no Web Locks query was issued, and no Worker CSP, runtime compatibility or storage-bucket identity was tested. A future run still requires reachable CDP, exact game/owned-Worker provenance and available origin/storage-key checks. The raw ledger's intended-diagnostic scope label does not mean that diagnostic ran.

## Visible game and normal exit

Gameplay showed **PANDA/five empty rows/1,310 coins** at **06:43:15.817179**, and again after closing the debug panel at **06:47:31.175931**. No guesses, rewards or preference/consent changes occurred. Settled Settings at **06:47:52.054783** showed **Sound On**, **Reduced Motion Off**, **Notifications Off** and unchecked analytics. Sound On is a later-launch observation of the preceding diagnostic's restored preference; no cloud-versus-local storage trace was captured.

A real **ASUS** banner was visible at startup and a **CIMA** banner in settled Settings. No advertiser action occurred, and neither callback/impression tracing nor the full banner matrix was established.

One normal app **Quit game** tap at **06:48:02.678891** returned to Facebook's main activity by **06:48:12.991258**. No Terms navigation, retry or host Quit occurred. Cleanup at **06:48:31.954190** confirmed `FbMainTabActivity`, removed temporary UI XML and the owned ADB forward, and recorded zero live CDP sessions and no Worker. This ordinary no-Terms exit does not establish post-Terms save recovery or a subsequent relaunch check. The outside-game screenshot contains unrelated feed content and remains private.

A fresh **post-exit** access check at **06:51:23.046593** found one Facebook main process, the original process absent, a replacement present, zero WebView debug sockets and no owned forward. That timestamp belongs to the later check; it does not retroactively date the initial loss of access. Process identifiers remain private.

## Connected desktop fallback

The connected Firefox session opened the known Riddle Quest URL but showed Facebook at `/gaming/play/` with a login prompt and no game frame at **06:49:51.723**. User sign-in was requested and remained pending when recorded. No credentials were entered; the owned test tab was left open and other tabs preserved. This observation applies to that session only, not every desktop route or global game availability.

Source, Testing artifact, Firebase and provider-server configuration remained unchanged. No automated game tests, build/upload, social send, purchase, destructive account cleanup, production promotion, publication or review submission occurred. API coverage and acceptance counts remain unchanged; the preceding gate-stage evidence is unchanged.
