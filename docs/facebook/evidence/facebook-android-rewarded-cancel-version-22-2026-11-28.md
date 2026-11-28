# Version 22 Android rewarded-ad cancellation — 28 November 2026

Early cancellation returned to **Out of Attempts**, with **1,310 coins unchanged** and ordinary actions enabled. No playable rewarded continuation was observed before the player explicitly closed that loss dialog. The subsequent empty-board restart is recorded separately. The [structured record](facebook-android-rewarded-cancel-version-22-2026-11-28.json) preserves timestamps, limits and selected private-evidence hashes.

## Identity and native cancellation

This continued the [discovery session](facebook-android-discovery-version-22-2026-11-28.md), without another launch or identity read. Its separate debug-menu observation established SDK **8.0**; SDK Info at **05:47:18.475340 UTC** confirmed [Testing version **22**](facebook-testing-version-22-2026-11-28.json), `/instant-bundle/2143220529953108/27134874202877022/index.html`, and **48 APIs**, including banner load. The artifact was unchanged.

Five ordinary incorrect PANDA guesses—APPLE, WATER, CHAIR, HOUSE and CLOUD—produced the loss dialog. A native Rakuten banner was visible at **05:52:30.324418**. **Watch an ad for another attempt** at **05:52:40.751873** showed Loading with the banner still visible; by **05:52:46.745097**, a native BetterHelp video displayed **Reward in 29s**, without the banner.

Android Back at **05:52:54.416458** opened a cancellation warning. **LOSE REWARD** was selected at **05:53:03.100662**. The **05:53:10.092399** image showed the native end card, despite its private filename `loss-returned.png`; it was not yet a return to gameplay. Closing that end card at **05:53:22.893792** returned to **Out of Attempts/1,310 coins** by **05:53:30.266227**. A fresh **05:53:40.047176** UI receipt confirmed Watch an ad, Use 50 Coins to Try Again and Use 100 coins to Skip Level enabled. Neither paid action was selected.

## Explicit loss close and cleanup

The loss dialog’s X at **05:53:40.065546** led to a spinner at **05:53:48.179890**, then PANDA/five empty rows/**1,310 coins** at **05:53:55.344241**. Source tracing identifies ordinary [loss dismissal](../../../src/gameplay/session/gameSession.ts), [completion receipt handling](../../../src/platform/bridge/browser/useGameMessageRouter.ts) and [same-index recovery](../../../src/gameplay/hooks/browser/useProvisionalPlayRecovery.ts). The observed restart is consistent with that flow, not evidence of a delayed ad grant. No request, grant or new session identity was traced.

Settings at **05:54:40.095433** showed Reduced Motion/Notifications Off and analytics unchecked. Normal app Quit at **05:54:55.667588** reached **FbMainTabActivity** by **05:55:05.590040**; activity confirmation and UI XML removal completed at **05:55:06.193891**. No host Quit or fresh relaunch occurred.

The cancellation/no-playable-continuation observation applies only before the explicit loss close; it is not proof that no grant occurred anywhere. No advertiser CTA, purchase, coin spend, console, probe, SDK patch, Terms navigation or consent change occurred. Normal game/backend activity was not traced. Source, artifact and Firebase/provider-server configuration were unchanged; no build, upload, publication or review submission occurred. Exact callbacks, raw SDK cancellation codes, entitlement variants, persistence across another launch and the wider ad matrix remain unverified. API coverage counts are unchanged; raw images and personal content remain private.
