# Android Google account setup

Google linking is optional for online play and required before new paid checkouts or rewarded referrals. The Account screen links Google to the current Firebase account with `linkWithCredential`. The Firebase uid stays unchanged, preserving server progress and Google Play's account binding. A fresh installation can open that same account after Google sign-in. A conflicting existing account requires a separate informed choice; progress and purchases are never merged automatically.

## Owner configuration

1. Enable Google in Firebase Authentication's sign-in providers for `riddle-quest-ec2b2`.
2. The Android package and local debug SHA-1/SHA-256 are registered. Register each production signing certificate, including Google Play App Signing. Register the Android package `com.roobsworld.riddlequest` and each signing certificate's SHA-1, including Google Play App Signing for Play installs. Debug certificates authorize only local builds.
3. Configure the OAuth consent screen and Android OAuth client for that package/certificate. Obtain the **Web application OAuth client ID** belonging to the same Firebase project.
4. Set the public `firebase.googleWebClientId` in the ignored Android `hosted.config.json`. This is an audience identifier, not a client secret. Never put an OAuth client secret in the app.
5. Verify linking and restoration on a device with Google Play services and a Google Account. Without this configuration the Account screen explains that Google sign-in is unavailable.

The native bridge uses Credential Manager 1.6.0 and Google ID 1.2.0. Google ID 1.2.1 requires Kotlin metadata newer than this React Native project's compiler; its release notes describe metrics changes only. Native selection checks its generated nonce, and Firebase verifies the Google token before accepting identity. Sign-out clears Credential Manager's provider session.

## Verification

`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node packages/android/scripts/verify-google-identity-emulator.mjs` uses actual Firebase Auth HTTP operations and the shared controller. It proves uid-preserving linking, signed Google subject claims, unchanged purchase-account binding, conflict retention and explicitly consented account recovery. It never contacts production or validates a real Google chooser. Evidence is recorded under `artifacts/android-google-identity/` without tokens.

Official references: [Android implementation](https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation), [Credential Manager releases](https://developer.android.com/jetpack/androidx/releases/credentials), [Google ID releases](https://developers.google.com/identity/android-credential-manager/releases), [Firebase account linking](https://firebase.google.com/docs/auth/web/account-linking), [Firebase Android setup](https://firebase.google.com/docs/auth/android/google-signin).
