# Android Google Play operations

The Android App in `packages/android` is a bare React Native 0.88 app that launches hosted-first: it connects to the player's Global Game Account and plays server-issued riddles through the shared host services, keeping the self-contained solo game of the YouTube Playable as its offline surface. See [ADR 0008](adr/0008-android-hosted-parity.md) (superseding [ADR 0007](adr/0007-android-react-native-shared-solo.md)) for the decision and `CONTEXT.md` for the vocabulary.

## What ships

- Gameplay, save schema, economy, achievements, copy, answer editing, and the boot/ready controllers come from `@riddle-quest/solo` and `@riddle-quest/core`; the app contains only native screens, the AsyncStorage save port, foreground lifecycle, and device locale.
- The reviewed Bundled Content Pack (`packages/portal/src/playable/generated/youtube-content-v1.json`) is bundled by Metro through the `#solo-content` alias, so Android plays the same riddles and daily schedule as the YouTube, Netflix, and Yahoo targets.
- Launch flow: the root (`src/AndroidApp.tsx`) resolves the device locale, signs in to Firebase anonymously, provisions the Global Game Account through `provisionAndroidAccount`, and shows the hosted home (Classic, Daily, Shop, Account, Play offline). While connecting or after a failure the connect screen offers Retry and Play offline. Hosted screens take their copy from the shared `@riddle-quest/solo` tables plus `src/i18n/hostedCopy.ts` (every supported locale, enforced by `hostedCopy.test.ts`). Release builds therefore request `INTERNET`; cleartext is permitted only to the emulator host loopback (`res/xml/network_security_config.xml`). There is still no sharing, multiplayer, analytics, or ad surface; purchases go through Google Play Billing (below).
- Offline surface: the self-contained game keeps its progress in app-private storage under `riddle-quest:android:save-v1` and is reached from the connect screen or the hosted home; its menu offers Play online to return. The choice is per session, not persisted. Whether it is retired or kept behind a connectivity check is plan item 4.1.
- Hosted configuration: `packages/android/hosted.config.example.json` holds the public Firebase web-app config (identical to the Jest target's). Copy it to `hosted.config.json` (gitignored) and set `emulators` to `{"host": "10.0.2.2", "authPort": 9099, "functionsPort": 5001}` to target local emulators; Metro bundles whichever file exists. Production calls additionally require App Check attestation (plan item 1.7), so until Play Integrity is configured the account surface only works against the emulators.
- Shop: coin packs and Premium through Google Play Billing Library 9.1.0 (`android/app/src/main/java/com/roobsworld/riddlequest/billing/PlayBillingModule.kt`, exposed to JavaScript as `NativeModules.RiddleQuestPlayBilling` and wrapped by `src/billing/playBilling.ts`). Play only reports purchases. The backend callables `grantAndroidPurchase` and `syncAndroidSubscriptions` verify every token with the Play Developer API, grant coins once per token (`androidPurchaseGrants/{sha256(token)}`), consume granted packs, acknowledge subscriptions, and mirror Premium onto the account with the same 30-day coin grant as Jest. Checkout binds each purchase to the account by passing SHA-256 of the Firebase uid as Play's `obfuscatedAccountId`; the backend refuses a token bound to another account. Every launch restores owned purchases, so a checkout interrupted before its grant is delivered next time. The SKUs and coin values are the Jest ones (`DEFAULT_PRODUCT_PRICING` and the two Premium plans); prices come from Play. Shop copy lives in `src/i18n/shopCopy.ts` for every supported locale.
- Application id `com.roobsworld.riddlequest`, `minSdk` 24, `targetSdk` 36, Hermes, new architecture.

## Local verification

```bash
pnpm --filter @riddle-quest/android check:types
pnpm --filter @riddle-quest/android test
```

Build a release APK for the emulator and drive it through adb. Both device checks use only the Android SDK's adb (`uiautomator` hierarchy reads and `input tap`), matching controls by their `testID`; no instrumentation or third-party automation is built into the app.

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
"$ANDROID_HOME/emulator/emulator" -avd Medium_Phone -no-window -no-audio &
cd packages/android/android && ./gradlew assembleRelease -PreactNativeArchitectures=x86_64 && cd ../../..
pnpm --filter @riddle-quest/android verify:device      # smoke: install, solve, relaunch
pnpm --filter @riddle-quest/android test:e2e:device    # scenario suite (node --test)
```

`verify:device` is the smoke check: install, clear data, switch from the hosted-first launch to the offline game, a fresh 300-coin save, solve the first Classic riddle on the on-screen keys, relaunch cold, confirm coins and progress. `test:e2e:device` runs the scenario suite from cleared data each time; the offline scenarios tap Play offline first (available while connecting and once connected, so they do not depend on the backend): Classic solve and persistence, hint and skip charges, the five-attempt limit with finish, buying a continue and solving after it, today's Daily with the closed card and persisted accessibility preferences, and an interrupted puzzle restored after backgrounding and a process kill. The hosted scenarios wait for the hosted home, open the account, round-trip through the offline menu and back, relaunch, and play a server-issued Classic: a wrong guess sent with Wi-Fi and data disabled is journaled, redelivered with the same request id after a relaunch, and an unsent draft survives a process kill before the solve. Evidence (screenshots and the last UI dump) lands under `artifacts/android-device-verification/` and `artifacts/android-e2e/<scenario>/`, both ignored by git.

The hosted scenarios (account provisioning, server-issued Classic) are skipped unless `RIDDLE_QUEST_HOSTED_EMULATOR=1` is set and the emulators are running and seeded (`FIRESTORE_EMULATOR_HOST=127.0.0.1:8099 node scripts/seed-emulator-classic.mjs` writes Classic riddles from the bundled pack; it refuses to run without the emulator variable): `pnpm --dir firebase-functions build && node firebase-functions/scripts/run-isolated-emulators.js emulators:start --only auth,functions,firestore --project riddle-quest-ec2b2`, with `hosted.config.json` pointing at them before the APK is built.

Pass an APK path or `--serial <device>` to `verify:device`, or set `RIDDLE_QUEST_APK`, `ANDROID_SERIAL`, and `RIDDLE_QUEST_SKIP_INSTALL=1` for the suite, to target an attached phone (`adb devices` must list it as `device`). The driver dismisses the emulator keyboard's permission and translate dialogs if they appear; the app itself keeps the system keyboard hidden while its own Latin keys are shown. Debug builds (`build:debug`) need the Metro server (`pnpm --filter @riddle-quest/android start`) and `adb reverse tcp:8081 tcp:8081`.

## Google Play submission

1. Create the upload key once and keep it off the repository: `keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`, then write `packages/android/android/app/keystore.properties` with `storeFile=upload.jks`, `storePassword`, `keyAlias`, `keyPassword`. Both files are gitignored; without them release builds sign with the debug key and must not be uploaded.
2. Bump `versionCode` and `versionName` in `packages/android/android/app/build.gradle`. Play rejects a reused `versionCode`.
3. Build the bundle for every architecture: `pnpm --filter @riddle-quest/android build:release` produces `android/app/build/outputs/bundle/release/app-release.aab`.
4. Run `verify:device` against a release APK of the same source (`assembleRelease`) before uploading.
5. In Play Console, create the app with the same application id, complete the Data safety form for the hosted account (app-specific user id, game progress, purchase history) per plan item 4.2, the content rating questionnaire, and target-audience declarations consistent with the Facebook Audience policy (13+). Upload the AAB to internal testing first, then promote.
6. Set up Play Billing before testing the shop on a device (owner steps):
   - In Play Console → Monetize → Products → In-app products, create the six coin packs with the exact ids `com.roobsworld.riddlequest.coinpack1` … `coinpack6` and activate them. The backend grants 250, 550, 900, 1600, 3400 and 7000 coins respectively regardless of the Play title or price.
   - Under Subscriptions, create `com.roobsworld.riddlequest.premium.monthly` (base plan P1M) and `com.roobsworld.riddlequest.premium.yearly` (base plan P1Y), each with one auto-renewing base plan. The shop buys the base-plan offer.
   - Enable the Google Play Android Developer API in the Firebase project's Google Cloud console. In Play Console → Users and permissions, invite the Cloud Functions runtime service account (the project's default compute service account unless the functions set another) with "View financial data, orders and cancellation survey responses" and "Manage orders and subscriptions". The backend reads its token from the metadata server with the `androidpublisher` scope; no key file is used.
   - Deploy `grantAndroidPurchase` and `syncAndroidSubscriptions` with the other functions.
   - Add licence testers (Settings → License testing) and install the app from the internal-testing track; Play Billing does not work for sideloaded builds whose package is unknown to Play. Test purchases are recorded with `testPurchase: true` on their grant.
7. Keep `targetSdkVersion` at the level Play currently requires for new submissions; update `android/build.gradle` when Google raises it.

## Boundaries

- Never add analytics, ads, or another target's SDK to the Android app. Firebase is limited to Auth, Functions and Firestore reads, as in the parity plan.
- Purchases go only through Google Play Billing and are granted only by the backend after Play Developer API verification; the app never grants coins or Premium itself, and never ships another store's or provider's payment SDK.
- Keep new solo logic in `@riddle-quest/solo`. `packages/portal/src/playable` only re-exports it and applies browser presentation.
