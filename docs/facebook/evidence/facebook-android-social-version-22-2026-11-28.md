# Version 22 Android Share and Invite cancellation — 28 November 2026

Native result Share and Profile Invite opened and were cancelled, with their game controls restored. Nothing was sent and no recipient was selected. The [structured record](facebook-android-social-version-22-2026-11-28.json) retains the exact candidate, observations and selected private-evidence hashes.

## Candidate and result

The fresh launch at **05:32:36.666465 UTC** displayed SDK **8.0** in the debug menu at **05:33:08.326746**. Rendered SDK Info at **05:33:35.633154** independently confirmed [Testing version **22**](facebook-testing-version-22-2026-11-28.json), `/instant-bundle/2143220529953108/27134874202877022/index.html`, and **47 advertised APIs**, without banner load. This was the unchanged artifact; no console, probe or SDK patch was used.

Ordinary PELICAN submission at **05:34:16 UTC** produced a **+35** result, observed at **05:34:21.412969**. The balance increased from **1,275 to 1,310 coins**; the later Profile receipt showed **23 wins**. These are normal gameplay changes, not social rewards.

## Share and Invite

Share was selected at **05:34:30.047285**. The native composer was visible at **05:34:44.160271**. Android Back at **05:34:50.008643** cancelled it; the result returned by **05:34:56.915602**. A fresh UI receipt at **05:34:59.764420** confirmed **Share** and **Next Level** enabled.

After Next Level and opening Profile, **Invite a friend** was selected at **05:35:57.327162**. The native invitation dialog appeared by **05:36:03.561158**. Its close control was selected at **05:36:19.697276**, returning to Profile by **05:36:26.972315**. The **05:36:29.625935** UI receipt confirmed Invite enabled, **1,310 coins** and **23 wins**.

These observations establish dialog opening, cancellation and recovered controls. No raw SDK cancellation code, delivery, recipient-side entry or referral outcome was traced.

## Final state and limits

The multiplayer lobby was opened and closed; discovery expansion/refresh, context selection, Find opponent and PvP were not performed or accepted. Closing the lobby returned to **PANDA/five empty rows/1,310 coins** at **05:40:38.153128**. Reduced Motion/Notifications remained Off and analytics unchecked.

Normal app Quit at **05:41:04.584208** reached **FbMainTabActivity** by **05:41:08.147245**. Device UI XML was removed at **05:41:16.245417**. No host Quit or subsequent relaunch occurred, so this record does not establish persistence of the new progression across another launch.

No share/invitation send, consent change, purchase, matchmaking or tournament participation occurred. Normal gameplay updated progress and coins; backend activity was not traced. Firebase/provider-server source and configuration were unchanged. No build, upload, Production promotion, publication or review submission occurred. Times bound observations, not exact callbacks. API coverage counts remain unchanged; raw screenshots and personal content remain private. The separate post-Terms persistence failure is unresolved.
