# Version 22 Android preference persistence — 28 November 2026

**Reduced Motion On persisted through normal app Quit and relaunch; restoring Off also persisted through a second Quit and third launch.** This unmodified, single-account check used ordinary UI on the connected Android phone. It establishes visible preference persistence, without identifying the storage mechanism or resolving the separate post-Terms save stall. The [structured record](facebook-android-preference-version-22-2026-11-28.json) retains the observations, session-specific API lists and private-evidence hashes.

## Candidate and saved change

All three rendered SDK Info checks confirmed SDK **8.0**, [Testing version **22**](facebook-testing-version-22-2026-11-28.json), and `/instant-bundle/2143220529953108/27134874202877022/index.html`. The unchanged artifact uses source `3d1d2e43a8dcfec2d6cd401de4200609601e9f37`, archive SHA-256 `d1b55275070597cdc6478ecae7879d414bbc57eb499f5cb9f71515019a1074b6`. The checks advertised **48**, **47** and **48** APIs respectively; banner-load support was absent only in the second list. These lists do not establish every advertised API or a served banner.

The first launch was recorded at **05:07:30.137388 UTC**; identity was verified at **05:11:28.417398**. Settings showed Reduced Motion **Off** at **05:11:43.882209**. The ordinary toggle at **05:11:47.471750** changed it to **On**, observed at **05:11:54.641356**. App Quit at **05:12:33.655366** reached **FbMainTabActivity**, confirmed at **05:12:41.832474**.

Two earlier label-based Quit attempts performed no action: one found no matching label, and the other could not obtain a fresh UI dump. The screenshot-grounded tap above is the accepted first Quit.

## Relaunch and restoration

The second launch at **05:12:50.240941** was independently identified at **05:13:37.339441**. Settings showed Reduced Motion **On** at **05:13:58.132162**. It was restored to **Off** at **05:14:07.655417**, observed at **05:14:13.081288**. Normal app Quit at **05:14:20.822640** reached Facebook main by **05:14:28.868414**.

The third launch at **05:14:36.839476** was independently identified at **05:15:30.198614**. Reduced Motion **Off** was confirmed at **05:15:51.695050**. Early SDK Info reads on the second and third launches failed; only the later successful reads establish those identities.

Settings closed at **05:15:58.253932**. The phase ended in full-height gameplay at **05:16:07.467323**, without a visible banner; device UI XML was removed at **05:16:08.181876**. There was **no third Quit**. GUITAR, five empty rows and **1,180 coins** remained unchanged across the launches. Notifications stayed Off and analytics stayed unchecked.

## Limits

No console, probe, SDK patch, Terms navigation, guess, reward, purchase, social send or consent change occurred. Only Reduced Motion changed and was restored. No storage/network trace distinguishes Facebook cloud storage from local fallback; no new gameplay-progress save or post-Terms recovery is established. Controller timestamps bound observations, not exact internal save or exit times. Screenshots remain private. Source, artifact, Firebase and provider-server configuration were unchanged; no upload, publication or review submission occurred. API coverage counts and full journey acceptance remain unchanged.
