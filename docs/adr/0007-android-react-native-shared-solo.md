---
status: accepted
---

# Ship Android through a bare React Native app that shares the Playable's solo logic

Riddle Quest will ship to Google Play as a bare React Native app in `packages/android`. The app is self-contained in the same way as the YouTube Playable: it bundles the reviewed content pack, keeps progress in app-private storage, and exposes no account, purchase, sharing, or multiplayer surface. Every rule, save document, economy value, achievement, localized string, and React controller the Playable uses was moved unchanged into `@qwordly/solo`, which the web Playable targets and the Android app both consume; the Android package adds only native views, AsyncStorage persistence, foreground lifecycle, and device locale.

## Considered options

- Wrapping the existing HTML5 bundle in a WebView was rejected because it ships DOM input handling and CSS layout that were tuned for hosted web surfaces, and it leaves nothing of the game native on the device.
- Rewriting the game logic inside the React Native app was rejected because the Playable's save gate, recovery, and economy rules are certification-tested; duplicating them would drift.
- Expo and EAS were rejected to keep native tooling to the Android SDK, Gradle, and the React Native CLI the repository can verify locally with adb.
- Reusing the Firebase-backed hosted play (Jest, Facebook, Reddit) was rejected for the first Android release because it would require a Google Play Billing grant design, App Check for native clients, and a privacy review before submission.

## Consequences

- `packages/portal/src/playable` is now a thin re-export layer; new solo behaviour belongs in `@qwordly/solo` so both surfaces change together.
- The shared React controllers take host presentation callbacks instead of touching the document; the web wrapper applies the same DOM classes it did before.
- Metro and Jest resolve `@qwordly/core` and `@qwordly/solo` straight to TypeScript sources, matching the Vite aliases, so no package build precedes a native build.
- Daily selection, local balance, and achievements have no value outside the device, exactly as for the YouTube Playable; a later Global Game Account integration must be a separate decision.
- Release builds carry no network permission. Debug builds keep `INTERNET` only for the Metro development server.
- The Android release gate is adb-driven (`verify:device`) and runs against an emulator or attached device, not a browser harness.
