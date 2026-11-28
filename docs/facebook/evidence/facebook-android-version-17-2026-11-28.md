# Version 17 physical Android verification — 28 November 2026

Riddle Quest Testing version **17**, bundle **29511535318440303**, was verified in rendered SDK Info after a fresh launch on the connected Samsung Galaxy S22 Android host. The [version 17 public upload receipt](facebook-testing-version-17-2026-11-28.json) binds this candidate to clean source `95cdbeaacf0933a656d62e38c81fd8608aa5afd9` and archive SHA-256 `643ff5e971979847f951c49f2ef0802ce930a8de2ad97f0681c226fc9ab381fa`. All 420 independently fetched runtime files matched the immutable archive. The provider ZIP container was not downloaded.

This was normal UI use of the uploaded candidate. No IGDebug panel, temporary observer, SDK replacement, runtime patch or app-controller call was active during the rewarded attempt or continuation. Earlier instrumented version 16 diagnosis remains separate from these native acceptance observations.

## Rewarded video and continuation

The first ordinary **Watch an ad for another attempt** action on this version displayed a real Meta rewarded video with **Reward in 16s** visible. The video was allowed to reach its final end card; no advertiser CTA was selected.

At **01:23:37 UTC**, selecting the final **Close** returned through a brief loading state. By **01:23:51 UTC**, the kettle puzzle showed five rows and six empty editable answer cells, with **1,035 coins unchanged**. Entering **P** and clearing it with Android Delete confirmed working game input after the continuation.

This establishes one completed native rewarded video, continuation and post-display input recovery on exact version 17. The existing authoritative claim is inferred from the reviewed client path and visible continuation outcome; no independent request/response trace was captured. It does not establish subscriber suppression, duplicate-claim recovery, early cancellation, no-fill, preparation interruption or every supported host.

## Settings, banner observation and Privacy navigation

Settings scrolled normally and its legal controls were reachable. No banner was visible on the initial observed version 17 visits. The later read-only capability observation below omitted `loadBannerAdAsync`, failing the existing paired-method banner admission guard and explaining the inactive fallback in that observed session. No no-fill response, placement status, earlier-session capability state or complete banner lifecycle is established.

The Privacy action opened Meta's external-link confirmation. Selecting **OPEN LINK** at **01:24:57 UTC** opened the Facebook browser on `roobsworld.com`, visibly showing **Riddle Quest on Facebook Privacy Notice**. Android Back returned to the same Settings screen, with **1,035 coins unchanged**. No optional cookie or analytics consent was changed.

## Unconfirmed Classic result and next-level stall

After closing Settings, the genuine **KETTLE** answer was submitted at **01:25:58 UTC**. The result showed **NICE JOB**, a pending chest without a reward amount and **1,035 coins unchanged**. **Next Level** opened the five-correct-answers tutorial; **Got it** continued to a spinner that persisted through **01:29 UTC**. At that point the win was not authoritatively confirmed in the observed UI. This was not a zero-coin reward or successful Classic progress acceptance; the later host-relaunch recovery is recorded separately below.

Code review identified that the loading state can persist if a terminal round is not replaced; the content request has a 15-second deadline and retry handling. That observation identifies a possible state path, not the cause of this native stall. The normal Settings → Quit action did not exit, as detailed below. The later interstitial observation is recorded below; no native display, dismissal, cadence or recovery success is established.

## Later read-only capability observation

After the stall, SDK Info rendered blank and supplied no usable API list. At **01:29:35 UTC**, one read-only console expression returned document readiness **complete**, visibility **visible**, an exact-version-17 bundle comparison of **true**, and the [47 advertised API names](facebook-android-sdk-capabilities-version-17-2026-11-28.json). Compared with the recorded version 16 session, only `loadBannerAdAsync` was removed; no names were added. `hideBannerAdAsync` remained advertised.

The expression did not patch the runtime, install observers, invoke an ad factory or override eligibility. It took place after the uninterrupted rewarded completion and later Classic stall, so those phases remain distinct. This per-session list explains the inactive banner guard at observation time; it does not prove no-fill, placement approval, support on other sessions/devices or the cause of the Classic stall.

## Pending app Quit, inconclusive probes and host-relaunch recovery

The app's **Settings → Quit** action at **01:29:56 UTC** did not exit. Native Settings actions remained disabled through **01:34:01 UTC**, more than four minutes later, with no unsaved-progress notice observed. This is not successful app-initiated Quit acceptance, and no trace establishes which underlying call held it pending.

A diagnostic `getEntryPointAsync` read resolved, but that cached result does not establish that the native bridge remained responsive. A fresh read-only `getDataAsync([])` probe was started; neither its result nor the scheduled ten-second diagnostic timer output was observed during approximately thirty seconds. This is inconclusive, not a classified SDK timeout. A narrow request-log search for relevant completion/content/auth endpoints during **01:24:40–01:31 UTC** found zero entries. That absence does not prove no request was made or identify the failure cause. No Firebase source/configuration was changed.

Home → Recents → the same game at **01:34:01 UTC** still showed the pending state. Recovery instead used the **host's top X → Quit game**, then relaunched the same game URL around **01:34:10 UTC**. By **01:35:09 UTC**, the welcome screen showed **1,060 coins** and a visible Meta banner. Around **01:36:30 UTC**, rendered SDK Info freshly confirmed version **17** and the exact path `/instant-bundle/2143220529953108/29511535318440303/index.html`. An earlier capture before the fields were ready is not identity evidence.

At **01:36:58 UTC**, Home → Recents → the same game returned to a full-height welcome screen with the banner removed and **Let's Play** reachable. This records visible layout/recovery only; offscreen hide timing, SDK callback ordering and the underlying hide result were not traced. The earlier 47-name capability observation belongs to the pre-relaunch session and remains accurate for that time; it does not describe the later session that visibly displayed a banner.

Selecting **Let's Play** at **01:37:07 UTC** restored the **KETTLE — NICE JOB** result with an explicit **+25 Coins**, **1,060 total**, and **Share**/**Next Level** controls. **Next Level** then loaded the new **ANCHOR** puzzle around **01:37:20 UTC**, with 1,060 coins, full-height layout and game input. No duplicate award was observed at that transition.

This establishes recovery of the pending Classic completion after a host quit/relaunch, with a visible 25-coin result and advancement to the next puzzle. It does not turn the app's failed Quit into a successful SDK-Quit check. Whether earlier native calls unwound, retried or completed later is unknown; no authoritative server request/response trace was obtained. The subsequent three-win interstitial observation is recorded below.

## Three subsequent wins and interstitial observation

After relaunch recovery, three new ordinary answers produced explicit displayed rewards:

| Submitted answer | Submission time (UTC) | Displayed reward | Displayed total |
| --- | --- | --- | --- |
| ANCHOR | 01:37:37 | +35 coins | 1,095 coins |
| KIWI | 01:38:10 | +25 coins | 1,120 coins |
| SPIDER | 01:38:57 | +35 coins | 1,155 coins |

The third result stayed in the foreground without IGDebug or further interaction until **01:40:34 UTC**, 97 seconds after submission. No visible interstitial appeared and no error was captured; **Next Level** and **Share** remained visible. This does not establish no-fill, a failed SDK request or a cadence defect. Native interstitial display remains unproven because its admission gates, requests and outcome were not independently traced. Later navigation and the subsequent app-Quit check are recorded separately below.

## Later navigation and normal app Quit

After the 97-second result observation, **Next Level** loaded the **PENCIL** riddle around **01:41 UTC**, with **1,155 coins** and full-height layout. **Settings → Quit** was tapped at **01:41:29 UTC**. By **01:41:32 UTC**, Android's top-resumed activity was Facebook **FbMainTabActivity**, confirming that the game had exited without using the host's X control.

This is a normal app-Quit success in the recovered session, separate from the earlier action that remained pending for more than four minutes. No subsequent relaunch was performed, so persistence of the 1,155 balance or pending writes after this exit is not established. The phone was left on Facebook's main surface with no debug panel or observer active.

## Separate app-Quit follow-up

Source inspection confirmed that the client preparation preceding Quit lacks a deadline. A new local correction is in progress for the next candidate, version 18, and is **not included in uploaded version 17**. The pending app-Quit observation above remains a version 17 result. This code finding does not by itself establish the underlying native stall's cause; later correction and verification require their own candidate/evidence record.

## Relation to local verification and prior diagnosis

The [version 16 placement diagnosis](facebook-android-ad-diagnosis-2026-11-28.md) traced the actual native `getPlacementID()` returning `undefined` before loading. Version 17 contains the narrow compatibility correction: the requested factory's handle must still have a callable getter, and each check accepts only the expected string or observed `undefined` metadata. Other values, missing/non-callable getters and exceptions remain rejected; account, foreground and fresh entitlement checks remain unchanged.

The upload receipt's [local verification](facebook-testing-version-17-2026-11-28.json) records 121 focused tests across seven suites, shared typecheck, canonical preflight, the full built-entry browser journey in 43.631 seconds and the inherited-method placement regression in 6.947 seconds. Those SDK/HTTP fixtures establish local regressions separately from the native phone outcomes above. The [foreground lifecycle evidence](facebook-ad-foreground-lifecycle-2026-11-27.md) remains the controlled proof for interrupted preparation and already-admitted display ownership; this uninterrupted native video does not verify those interruption cases.

Production promotion, review submission and publication were not performed. The existing Vercel deployment remains version 15. No Firebase or provider-server source/configuration change, backend deployment, purchase, social send, notification opt-in or account deletion occurred in this check. The wider J01–J14 acceptance matrix remains open.
