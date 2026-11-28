# Version 23 Android interstitial observation — 28 November 2026

Exact version 23 displayed a native interstitial after the third ordinary win, returned to enabled result controls and restored the next puzzle/balance after normal Quit/relaunch. The fixed trace reached **show-resolved → success → finished**. This is narrow native evidence, not full J09 acceptance or an explanation of version 22's missing-ad observation. The [structured record](facebook-android-interstitial-version-23-2026-11-28.json) preserves both trace reads, bounded observations and 18 private-evidence hashes.

## Candidate and ordinary wins

The launch at **07:19:54.107363 UTC** ran [Testing version 23](facebook-testing-version-23-2026-11-28.json), source `579f9d5def20b5007218663702de0bd3e11da1c4`, bundle `40683991141214635`. A separate debug menu showed **SDK 8.0**; SDK Info at **07:20:28.500951** confirmed the exact path and **48 advertised APIs**, including banner load. The misleadingly named `gameplay-restored.png` actually showed **88% Preparing** with a served CGMA/Meta banner. Actual gameplay at **07:21:01.261338** restored **PANDA/five empty rows/1,310 coins**.

| Ordinary win | Settled/returned result observed UTC | Reward | Balance |
|---|---|---:|---:|
| PANDA | 07:21:26.097836 | +35 | 1,345 |
| LADLE | 07:24:24.921294 | +35 | 1,380 |
| RAKE | 07:26:41.525434, after native ad closure | +35 | 1,415 |

LADLE's result also showed a Rakuten banner. These increases were gameplay rewards; no advertiser CTA was selected. The first read-only console invocation at **07:23:23.861413** returned `completion` and `cadence-one`. It was closed before proceeding. RAKE was ready at **07:24:46.529307** and submitted at **07:25:05**; the earlier `puzzle-three.png` still showed loading.

## Native display and trace

The held third result showed an **Ansys/Meta** fullscreen creative at **07:25:29.875476**. Closing it at **07:25:40.327462** led to a **Bizbazar/Meta** surface, observed at **07:25:48.616928**. Skip at **07:26:00.664471** led to an end card; its X was pressed at **07:26:14.036666**. These surfaces do not establish two SDK requests or intermediate game recovery. The actual RAKE result returned at **07:26:41.525434**, with Next Level and Share confirmed enabled at **07:26:44.311687**. No debug interaction occurred between third submission and final ad closure.

The second read at **07:27:58.740620** contained the earlier console output plus the latest **19-mark** capture: opportunity/admission, eligibility, dialog guard/operation, create/load, renewed eligibility, show invocation/resolution, success and finished. No failure category appeared. The Performance-only show span was **61,465.6 ms** and dialog guard-to-operation span **1,180.4 ms**; controller times were not mixed into those calculations. Latest-per-phase marks do not establish an exact SDK invocation count.

Both **1,972-character** helper transports were verified. The reader only filtered existing fixed marks and printed stage/time; it made no SDK calls or mutation, probe globals, timers, Workers or CDP connection. Two failed console-label lookups sent no input. Debug UI/readback may still affect lifecycle or scheduling.

## Persistence and cleanup

Next Level showed **CHESS/five empty rows/1,415 coins** at **07:28:42.794422**. Settings retained Sound On, Reduced Motion Off, Notifications Off and unchecked analytics. Normal app Quit at **07:29:25.461422** reached Facebook main by **07:29:33.848852**; an earlier failed text lookup sent no input.

Relaunch at **07:29:42.090987** reconfirmed exact version 23/48 APIs at **07:30:35.278694**. CHESS/five empty rows/1,415 coins returned at **07:30:52.875322**; a fresh UI receipt at **07:31:08.023919** confirmed balance and enabled Settings/Multiplayer navigation, alongside a full-height screenshot. No second-session guesses, preference changes or console invocation occurred. Final **in-game Settings → Quit game** at **07:33:54.898685** reached Facebook main by **07:34:01.942318**. Cleanup at **07:34:23.053054** confirmed the main activity, no temporary UI XML, ADB forwards or active owned helper processes. Host Quit was not used.

No Terms navigation, consent change, social send, purchase or backend change occurred. Persistence mechanism/server grants, subscriber suppression, failure/cooldown/cap variants and the earlier post-Terms issue remain unverified. Coverage counts are unchanged.
