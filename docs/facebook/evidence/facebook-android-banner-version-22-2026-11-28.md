# Version 22 Android banner observations — 28 November 2026

Two unmodified, single-account sessions on the connected Android phone verified narrow banner behavior on [Riddle Quest Testing version 22](facebook-testing-version-22-2026-11-28.json). The second session displayed two real Meta banners in reserved space beneath Settings; the banner disappeared before the native Terms confirmation and during Android Home transition. The full J10 journey remains open. The [structured record](facebook-android-banner-version-22-2026-11-28.json) retains exact session identities, capability lists and observation times.

## Candidate and first session

Both rendered SDK Info checks confirmed SDK **8.0**, version **22**, and `/instant-bundle/2143220529953108/27134874202877022/index.html`. This is the existing artifact from source `3d1d2e43a8dcfec2d6cd401de4200609601e9f37`, archive SHA-256 `d1b55275070597cdc6478ecae7879d414bbc57eb499f5cb9f71515019a1074b6`; no source change or upload occurred for these checks.

The first session launched at **04:26:20.554910 UTC**. SDK Info at **04:26:47.931728** advertised **47 APIs**, including banner hide but excluding banner load. No banner was visible on welcome or Settings. The native Terms confirmation was observed at **04:27:32.925590**, then **CANCEL** at **04:27:39.191092** returned to Settings. App Quit at **04:27:48.719695** reached **FbMainTabActivity** by **04:27:59.807585**. This session did not open the external Terms page or test a served banner.

## Served banners and native-dialog cancellation

The second launch at **04:28:09.892805** was independently identified through SDK Info at **04:28:32.106070**. It advertised **48 APIs**, adding only `loadBannerAdAsync` to the first session’s list. Settings initially occupied full height at **04:29:14.877287**. By **04:29:21.523233**, a real Meta **ASUS** banner occupied reserved bottom space, with Settings controls reachable by ordinary scrolling.

An attempted text-labeled Terms action failed before any tap. The screenshot-grounded Terms tap at **04:29:47.193558** is the actual action: its **04:29:47.400483** image showed the banner removed and full-height content with a spinner; **04:29:53.436240** showed the unobstructed native confirmation without a banner. **CANCEL** at **04:29:59.897432** returned to Settings. The fresh **04:30:15.146767** observation showed enabled controls, full-height layout and no banner.

Closing Settings at **04:30:46.272112** restored full-height gameplay. Reopening at **04:30:54.773855** produced a second real Meta **Rakuten** banner in reserved space by **04:31:06.688723**. The first banner had already disappeared during the native-dialog transition; this sequence does not directly verify removal when closing Settings while a banner is still served.

## Android Home and return

Home at **04:31:13.991436** was followed by a transitional image at **04:31:14.249618** showing the banner removed; the Android home screen was confirmed at **04:31:20.359526**. Recents at **04:31:21.883471** and the Facebook card at **04:31:53.332257** returned to full-height Settings without a banner by **04:32:00.910483**.

Closing Settings at **04:32:11.661657** returned to gameplay. Reopening at **04:32:25.794877** showed no banner at **04:32:32.243843** or **04:32:59.606258**. No SDK-call trace was collected, so these observations do not establish whether a request occurred, an admission gate prevented it, or there was no fill.

App Quit at **04:33:03.634809** reached **FbMainTabActivity** by **04:33:12.647750**. Temporary device UI XML was removed at **04:33:27.707700**. Visible gameplay throughout remained GUITAR with five empty rows and **1,180 coins**.

## Scope and remaining acceptance

These checks used normal UI and rendered SDK Info only: no JavaScript console, probe, SDK patch, ad CTA click, guess, purchase, reward, preference/consent change or social send. No gameplay progress or preference change was made; automatic storage writes are not excluded, and no new-save persistence is proved. Screenshots and raw device observations remain private local evidence.

The observations establish visible served banners, reserved layout, native-confirmation clearance, cancellation recovery and disappearance around Home. They do not trace exact hide-callback timing, placement calls or provider impression receipts. Direct served-banner-to-gameplay removal, subscriber/durable-removal behavior, entitlement refresh, late loads, no-fill, hide rejection/retry, account replacement, deletion and the remaining host variants still require acceptance. The full **J10** journey and **79-row API inventory counts remain unchanged**. These sessions are separate from the earlier [version 22 warning checks](facebook-settings-warning-rendering-2026-11-28.md) and any later instrumented diagnostics. Firebase, Production, review submission and publication were untouched.
