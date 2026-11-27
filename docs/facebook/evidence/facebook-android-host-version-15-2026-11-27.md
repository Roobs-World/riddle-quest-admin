# Version 15 physical Android host check — 27 November 2026

**Riddle Quest Testing version 15 loaded in the Facebook app on the connected Samsung Galaxy S22.** The rendered IGDebug SDK Info identified app `1748953042991569` and exact bundle `30470981679157112`. The saved kettle puzzle and **1,035 coins** were present. These are narrow mobile observations; they do not complete every native API journey or establish public availability.

## Device and exact candidate

| Field | Observed value |
| --- | --- |
| Device | Physical Samsung Galaxy S22, model SM-S901U |
| Android | 16, API level 36 |
| Facebook app | 588.0.0.42.55 |
| Launch | Public Riddle Quest Play URL, opened in the Facebook app |
| Version / bundle | 15 / `30470981679157112` |
| Rendered game host | `apps-1748953042991569.apps.fbsbx.com` |
| Rendered bundle path | `/instant-bundle/2143220529953108/30470981679157112/index.html` |
| Environment / entry source | `standard` / `shareable_link` |
| Assigned SDK | 8.0 NEZP, as recorded in the accepted Testing upload |

The version and bundle were read from **IGDebug → SDK Info** on the phone, rather than inferred from the Play URL. The [accepted archive record](facebook-testing-version-15-2026-11-27.json) binds this bundle to source `66de0e9da202b5889da5bbf1dd54a98b03bb6bc0`, SHA-256 `5803b051ff965b97b7ea1e8669d816172983a7c7a1ae8ab8a44ba9a630cbf824` and 2,865,675 bytes. This phone check did not independently download or hash the bundle. Private launch parameters, device serials, account identifiers and personal images are excluded.

## Advertised mobile capabilities and Settings

The [sanitized mobile SDK observation](facebook-android-sdk-capabilities-version-15-2026-11-27.json) retains all **47 advertised API names** from the rendered panel. It is a capability advertisement, not proof that each method was called successfully or approved for every player.

- `hideBannerAdAsync` was advertised; `loadBannerAdAsync` was absent. Settings showed no banner. The missing load advertisement fails the client's paired-method admission requirement. No banner request was forced; load, no-fill, impression and hide success remain unverified.
- `canCreateShortcutAsync` and `createShortcutAsync` were advertised, but **Add to home screen** was absent from Settings. Shortcut eligibility was not established, and no shortcut prompt or cancellation was exercised on this phone.
- `performHapticFeedbackAsync` was absent. No vibration opt-in or feedback request was made. Supported-device haptic acceptance remains open.
- `onPause` and `onResume` were advertised. Advertisement alone does not establish callback execution; the actual background/return outcome is recorded separately below.
- Settings showed **Sound Off**, **Reduced motion Off** and **Notifications Off**. No preference was edited and no notification or other consent was granted.

The desktop observation contained 49 advertised names. The two names present there but absent from this phone's list were `getDisplayMode` and `onDisplayModeChange`. This comparison describes these two sessions only; it is not a general platform-support claim.

## Native Privacy Policy cancellation

From Settings, selecting **Privacy Policy** opened the Facebook app's native **Open link in Facebook browser?** confirmation. Selecting **CANCEL** dismissed that confirmation and restored Settings. The external browser was not opened. This establishes the phone's native cancellation/recovery path for Privacy Policy; mobile Terms of Use and successful external navigation were not exercised.

## Background and return

1. Closed Settings. Narrow activity metadata identified Facebook's `QuicksilverActivity` as the resumed game task.
2. Pressed Android **Home** and confirmed the Android launcher became the resumed activity.
3. Opened **Recents**, selected the existing Facebook card and confirmed the same `QuicksilverActivity` and task resumed.
4. The kettle puzzle, **1,035 coins** and six editable answer cells remained. Entering **K** through the game's keyboard filled the enabled first cell.
5. The floating IGDebug button covered the on-screen Backspace hit area; tapping that area opened IGDebug instead. After closing debug, ordinary Android **KEYCODE_DEL** cleared the first cell, which remained enabled. No answer was submitted and no reward was earned.

This establishes a real native background/return transition and usable input after return. It does not independently trace `onPause`, `onResume`, save flushing or presence callbacks. The Backspace obstruction came from the provider's developer overlay; this observation does not establish a client keyboard defect. The game was left playable with the answer cleared and **1,035 coins** unchanged.

## Separate Vercel hosting status

The owner authorized hosting Riddle Quest in **Craig Beswetherick's projects** on Vercel, with intended project `riddle-quest-facebook-testing`. An isolated static payload containing the accepted artifact's **420 runtime files** was prepared in temporary storage only. Project creation returned: **“Vercel API request failed (403: forbidden). You don't have permission to create the project.”** Both consent links were reported expired, including a fresh link that failed immediately. Browser **Continue with ChatGPT** reached a password prompt, so authentication still required the owner. No Vercel project URL, file upload or deployment was obtained. This limitation does not change the observed Facebook-hosted candidate.

## Scope and remaining acceptance

This evidence adds physical Android observations to **H15**, principally J01/J02/J04 and the unsupported banner/haptics cases. It does not establish successful social delivery, context joins, tournaments, Rooms, native profile overlays, mobile ads, subscriber suppression, purchases, account replacement/deletion or notification delivery. The remaining supported-host journeys in the [submission checklist](../facebook-api-submission-checklist-2026-11-27.md) stay open.

No social message, invite or score was sent by this phone check. No purchase, opt-in, install, device setting change or preference change was performed. No SDK replacement or runtime patch was used. No Firebase source, configuration or deployment changed. No new Facebook upload, production promotion, publication or review submission was performed in this unit.
