# Android Google Play operations

The Android App in `packages/android` is a bare React Native 0.88 app that plays the same self-contained solo game as the YouTube Playable. See [ADR 0007](adr/0007-android-react-native-shared-solo.md) for the decision and `CONTEXT.md` for the vocabulary.

## What ships

- Gameplay, save schema, economy, achievements, copy, answer editing, and the boot/ready controllers come from `@qwordly/solo` and `@qwordly/core`; the app contains only native screens, the AsyncStorage save port, foreground lifecycle, and device locale.
- The reviewed Bundled Content Pack (`packages/portal/src/playable/generated/youtube-content-v1.json`) is bundled by Metro through the `#solo-content` alias, so Android plays the same riddles and daily schedule as the YouTube, Netflix, and Yahoo targets.
- Solo progress currently lives in app-private storage under `riddle-quest:android:save-v1`. Hosted parity is being added in phases ([plan](android-parity-plan.md)); the first slice signs the device in to Firebase anonymously and provisions its Global Game Account through `provisionAndroidAccount`. Release builds therefore request `INTERNET`; cleartext is permitted only to the emulator host loopback (`res/xml/network_security_config.xml`). There is still no purchase, sharing, multiplayer, analytics, or ad surface.
- Hosted configuration: `packages/android/hosted.config.example.json` holds the public Firebase web-app config (identical to the Jest target's). Copy it to `hosted.config.json` (gitignored) and set `emulators` to `{"host": "10.0.2.2", "authPort": 9099, "functionsPort": 5001}` to target local emulators; Metro bundles whichever file exists. Production calls additionally require App Check attestation (plan item 1.7), so until Play Integrity is configured the account surface only works against the emulators.
- Application id `com.roobsworld.riddlequest`, `minSdk` 24, `targetSdk` 36, Hermes, new architecture.

## Local verification

```bash
pnpm --filter @qwordly/android check:types
pnpm --filter @qwordly/android test
```

Build a release APK for the emulator and drive it through adb. Both device checks use only the Android SDK's adb (`uiautomator` hierarchy reads and `input tap`), matching controls by their `testID`; no instrumentation or third-party automation is built into the app.

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
"$ANDROID_HOME/emulator/emulator" -avd Medium_Phone -no-window -no-audio &
cd packages/android/android && ./gradlew assembleRelease -PreactNativeArchitectures=x86_64 && cd ../../..
pnpm --filter @qwordly/android verify:device      # smoke: install, solve, relaunch
pnpm --filter @qwordly/android test:e2e:device    # scenario suite (node --test)
```

`verify:device` is the smoke check: install, clear data, a fresh 300-coin save, solve the first Classic riddle on the on-screen keys, relaunch cold, confirm coins and progress. `test:e2e:device` runs the scenario suite from cleared data each time: Classic solve and persistence, hint and skip charges, the five-attempt limit with finish, buying a continue and solving after it, today's Daily with the closed card and persisted accessibility preferences, and an interrupted puzzle restored after backgrounding and a process kill. Evidence (screenshots and the last UI dump) lands under `artifacts/android-device-verification/` and `artifacts/android-e2e/<scenario>/`, both ignored by git.

The hosted-account scenario is skipped unless `RIDDLE_QUEST_HOSTED_EMULATOR=1` is set and the emulators are running: `pnpm --dir firebase-functions build && node firebase-functions/scripts/run-isolated-emulators.js emulators:start --only auth,functions,firestore --project riddle-quest-ec2b2`, with `hosted.config.json` pointing at them before the APK is built.

Pass an APK path or `--serial <device>` to `verify:device`, or set `RIDDLE_QUEST_APK`, `ANDROID_SERIAL`, and `RIDDLE_QUEST_SKIP_INSTALL=1` for the suite, to target an attached phone (`adb devices` must list it as `device`). The driver dismisses the emulator keyboard's permission and translate dialogs if they appear; the app itself keeps the system keyboard hidden while its own Latin keys are shown. Debug builds (`build:debug`) need the Metro server (`pnpm --filter @qwordly/android start`) and `adb reverse tcp:8081 tcp:8081`.

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
