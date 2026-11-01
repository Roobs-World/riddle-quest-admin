# Android Google Play operations

The Android App in `packages/android` is a bare React Native 0.88 app that plays the same self-contained solo game as the YouTube Playable. See [ADR 0007](adr/0007-android-react-native-shared-solo.md) for the decision and `CONTEXT.md` for the vocabulary.

## What ships

- Gameplay, save schema, economy, achievements, copy, answer editing, and the boot/ready controllers come from `@qwordly/solo` and `@qwordly/core`; the app contains only native screens, the AsyncStorage save port, foreground lifecycle, and device locale.
- The reviewed Bundled Content Pack (`packages/portal/src/playable/generated/youtube-content-v1.json`) is bundled by Metro through the `#solo-content` alias, so Android plays the same riddles and daily schedule as the YouTube, Netflix, and Yahoo targets.
- Progress lives only in app-private storage under `riddle-quest:android:save-v1`. There is no account, purchase, sharing, multiplayer, analytics, or ad surface, and release builds request no network permission.
- Application id `com.roobsworld.riddlequest`, `minSdk` 24, `targetSdk` 36, Hermes, new architecture.

## Local verification

```bash
pnpm --filter @qwordly/android check:types
pnpm --filter @qwordly/android test
```

Build a release APK for the emulator and drive it through adb. The script installs the APK, clears app data, confirms a fresh 300-coin save, starts Classic, types the first answer on the on-screen keys, checks the reward, relaunches cold, and confirms the coins and Classic progress persisted. Screenshots, UI dumps, and `summary.json` land in `artifacts/android-device-verification/` (ignored by git).

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
"$ANDROID_HOME/emulator/emulator" -avd Medium_Phone -no-window -no-audio &
pnpm --filter @qwordly/android build:release -- -PreactNativeArchitectures=x86_64
pnpm --filter @qwordly/android verify:device
```

Pass an APK path or `--serial <device>` to `verify:device` to target an attached phone (`adb devices` must list it as `device`). Debug builds (`build:debug`) need the Metro server (`pnpm --filter @qwordly/android start`) and `adb reverse tcp:8081 tcp:8081`.

## Google Play submission

1. Create the upload key once and keep it off the repository: `keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`, then write `packages/android/android/app/keystore.properties` with `storeFile=upload.jks`, `storePassword`, `keyAlias`, `keyPassword`. Both files are gitignored; without them release builds sign with the debug key and must not be uploaded.
2. Bump `versionCode` and `versionName` in `packages/android/android/app/build.gradle`. Play rejects a reused `versionCode`.
3. Build the bundle for every architecture: `pnpm --filter @qwordly/android build:release` produces `android/app/build/outputs/bundle/release/app-release.aab`.
4. Run `verify:device` against a release APK of the same source (`assembleRelease`) before uploading.
5. In Play Console, create the app with the same application id, complete the Data safety form as "no data collected or shared" (progress never leaves the device), the content rating questionnaire, and target-audience declarations consistent with the Facebook Audience policy (13+). Upload the AAB to internal testing first, then promote.
6. Keep `targetSdkVersion` at the level Play currently requires for new submissions; update `android/build.gradle` when Google raises it.

## Boundaries

- Never add Firebase, analytics, ads, identity, purchases, sharing, multiplayer, or another target's SDK to the Android app.
- Google Play Billing is a Capability Gap until a server-authoritative, idempotent grant design exists; do not add a purchase surface before that decision.
- Keep new solo logic in `@qwordly/solo`. `packages/portal/src/playable` only re-exports it and applies browser presentation.
