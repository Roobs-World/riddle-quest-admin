# Version 20 storage-boundary diagnostic — 28 November 2026

This separate, instrumented Android session is **diagnostic evidence, not acceptance or a fix**. Testing remained **20**, bundle **40287594420886203**, from source `185548c16aede8b57c1d957773631faf36b87e82`; the [release receipt](facebook-testing-version-20-2026-11-28.json) and earlier [Quit phase evidence](facebook-quit-phase-tracing-2026-11-28.md) retain their original scopes. The [structured observations](facebook-storage-boundary-diagnostic-version-20-2026-11-28.json) contain no commands or payloads.

## Method and limits

A temporary observer wrapped the actual player's `getDataAsync`, `setDataAsync` and `flushDataAsync`, retaining at most 64 records containing only method, local sequence number, phase and timestamp. It preserved receiver, arguments, returned promise and thrown/rejected value; it made no independent SDK calls and added no timers. Attached promise observers add microtasks and affect rejection-observation bookkeeping, so interference cannot be excluded. No data keys, payloads, errors or player identities were collected.

A temporary local fixture checked receiver/arguments, promise identity, throws/rejections and descriptor restoration. This was not a full application regression. Cleanup restored original descriptors only where the wrapper still owned the property and deleted its global record. Wrapper-source checks are narrower than complete object-identity proof.

## Observations

Launch began at **03:31:13 UTC**. SDK Info at **03:32:07.701624** confirmed exact version 20/bundle path, 48 APIs and banner loading. The observer installed at **03:33:13.768**. Let’s Play at **03:33:31.174** restored GUITAR, five empty rows and **1,180 coins**; a native banner appeared below Settings.

Terms at **03:34:13.591848**, then OPEN at **03:34:15.926890**, displayed Riddle Quest Terms on `roobsworld.com`; cookie choices were untouched. Android Back at **03:34:29** returned to the game.

The **03:35:34.725** read, before any Quit, contained three settled calls:

| Method | Start UTC | Resolution UTC |
| --- | --- | --- |
| `setDataAsync` | 03:34:15.786 | 03:34:15.963 |
| `flushDataAsync` | 03:34:15.963 | 03:34:16.782 |
| `flushDataAsync` | 03:34:16.783 | 03:34:16.815 |

App Quit at **03:35:58.037869** remained disabled at **03:36:14**. The latest **03:36:46.373** read still contained exactly those six start/resolution events, with no overflow, while Quit was busy. The trace reached `guard → operation → preparation → projection`; no later phase appeared. The after-read receipt also contains the earlier read; the structured evidence selects the latest result.

At **03:37:46.162**, all three method-source checks matched the observer. Cleanup at **03:38:32.717** confirmed its global absent. A subsequent Web Locks query filtered to the exact operation-lock name and requested held/pending modes only. Its request was logged at **03:39:10.877670**; a console inspection at **03:40:52.843** found request text but neither result nor failure text. This is an **unanswered observation**, not an empty lock inventory.

Host Quit at **03:41:33** reached Facebook's `FbMainTabActivity`; temporary device UI XML was removed. This was host cleanup, not app-Quit recovery. No guesses, preferences, consent, rewards or social sends changed; no observer remained active.

## Interpretation

No new call was recorded at the observed SDK storage boundary after Quit. This narrows the investigation but does not identify the pending checkpoint/deletion queue, lock or native cause. Meta distinguishes [accepted/scheduled writes](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player#setdataasync) from [successful persistence on flush resolution](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player#flushdataasync); earlier settled calls do not prove that later queued work completed.

No source, artifact, Testing assignment, Firebase or provider configuration changed in this session. Any later watchdog correction is separate and is not included in version 20.
