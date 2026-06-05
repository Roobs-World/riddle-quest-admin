npx eas-cli build --profile development --platform android

pnpm exec expo start --clear ( clears metro cache )
pnpm exec expo run:android

firebase deploy --only functions

if the build breaks, then:

1. npx expo prebuild --clean in root
2. ./gradlew clean in the android directory
3. try a new build

use firebase functions:config:get to return the config settings used

to create a preview build for distribution run:
pnpm exec eas build --platform android --profile preview
or
eas build --platform android --profile preview

adb install path/to/app.apk

## RN 0.85 Upgrade Notes

- Runtime now targets React Native `0.85.1` with Expo SDK 56 canary.
- Node.js minimum version is `20.19.4` (`.nvmrc` and `package.json` engines).
- Run upgrade guardrails:
  - `pnpm run check:rn-upgrade`
  - `pnpm run baseline:report`
  - `pnpm run validate:upgrade`
- Metro TLS (HTTPS/WSS for dev) is supported when env vars are set:
  - `METRO_TLS_CERT_PATH`
  - `METRO_TLS_KEY_PATH`
  - optional `METRO_TLS_CA_PATH`
- Shared Animation Backend flag:
  - `EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND=true`
  - RN `0.85.1+` is now available in this project; keep the flag disabled by default and enable it only for targeted experimental-channel test builds.

## Project Overview

This is a mobile game that combines the popular Wordle-style gameplay with challenging riddles. Built using React Native and Firebase, the game features user authentication, multiple game modes, in-app purchases for a coin system, and customizable user profiles.

## Marketing Kit

The 90-day pre-launch marketing package lives in [docs/marketing/README.md](docs/marketing/README.md). It implements the multilingual launch plan for Riddle Quest with store metadata, ASO experiments, creator outreach templates, a content calendar, press kit copy, tracking/KPI definitions, and a static pre-launch landing page at [docs/marketing/prelaunch-landing-page.html](docs/marketing/prelaunch-landing-page.html).

## Release Readiness Checklist

Use this checklist to track the manual security, privacy, store, and account-deletion work that still needs to happen before release. Keep evidence for each completed task: date completed, person responsible, console screenshots where useful, deployed versions, and any follow-up notes.

Current ownership note: the current Codex thread is actively working this checklist and the external legal blocker tracked in `docs/legal-todo.html`. As of 2026-06-02, the remaining open items are the external security, App Check console, and store-console tasks. No task lock is applied in this single-agent workspace; keep the remaining open items visible as owner-controlled blockers rather than silently dropping them.

### Off-repo security tasks

- [ ] Rotate exposed credentials
  - Follow [docs/credential-rotation-runbook.md](docs/credential-rotation-runbook.md).
  - Repo-side copies of `firebase-functions/.env.default.backup`, `firebase-functions/.runtimeconfig.json`, and `firebase-functions/qwordly-admin-sdk.json` are now redacted in the current tree so the live values are no longer sitting in plain text here.
  - In Google Cloud Console, open IAM and Admin > Service Accounts.
  - Find the Firebase Admin SDK service account used by this project.
  - Disable and delete the exposed service account key.
  - Create a replacement key only if a local admin script still needs one, and store it outside the repository.
  - Rotate every value that appeared in tracked `.env`, `firebase-functions/.env.default.backup`, and `firebase-functions/.runtimeconfig.json`.
  - Rotate provider-side credentials in OpenAI, Apple, Meta/Facebook, Google Cloud, and Firebase as applicable.
  - Confirm old keys are revoked or disabled before marking this complete.

- [ ] Set fresh Firebase Functions secrets
  - Set fresh production values with the Firebase CLI:

    ```bash
    firebase functions:secrets:set OPENAI_API_KEY
    firebase functions:secrets:set APPLE_SHARED_SECRET
    firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT
    firebase functions:secrets:set FACEBOOK_APP_SECRET
    ```

  - Redeploy Firebase Functions after the secret versions are updated:

    ```bash
    firebase deploy --only functions
    ```

  - Smoke test the flows that depend on these secrets: riddle generation, Apple purchase validation, Google purchase validation, and Facebook auth/server integrations.
  - This remains an external provider-console task until secret rotation is coordinated and confirmed.

- [ ] Purge secrets from git history
  - Follow [docs/git-history-secret-purge.md](docs/git-history-secret-purge.md).
  - Use a fresh clone, not this current dirty worktree.
  - Coordinate with anyone else using the repo before rewriting history.
  - Remove historical copies of:
    - `.env`
    - `firebase-functions/.env.default.backup`
    - `firebase-functions/.runtimeconfig.json`
    - `firebase-functions/qwordly-admin-sdk.json`
  - Recommended command from the purge plan:

    ```bash
    git filter-repo --force \
      --path .env \
      --path firebase-functions/.env.default.backup \
      --path firebase-functions/.runtimeconfig.json \
      --path firebase-functions/qwordly-admin-sdk.json \
      --invert-paths
    ```

  - Force-push only after coordination:

    ```bash
    git push --force-with-lease --all
    git push --force-with-lease --tags
    ```

  - After the rewrite, have collaborators reclone or hard-reset, then run a secret scanner against the rewritten history.
  - This remains a coordinated history-rewrite task and is intentionally left open until a fresh clone / force-push window is approved.

- [ ] Enable Firebase App Check enforcement
  - Configure valid Firebase App Check providers for both iOS and Android in the Firebase Console.
  - Repo-side setup is now in place and verified: `@react-native-firebase/app-check` is declared in `package.json` and installed, the Expo config plugin is enabled, the app boots App Check during startup with platform-specific providers, and the focused App Check service tests pass.
  - Confirm the released clients can request and send App Check tokens.
  - Enable enforcement for sensitive deployed callable Functions only after client verification.
  - Smoke test callable Function flows from real iOS and Android builds after enforcement is enabled.
  - Repo code now carries `enforceAppCheck: true` on the sensitive callable surface, including `updateUsername`; the remaining blocker is Firebase Console activation plus live client verification.
  - 2026-06-02 verification refresh: focused App Check/profile Jest and TypeScript passed again in this pass, so the repo-side implementation remains complete while the Firebase Console providers and live-device validation stay external.
  - 2026-06-01 source-side implementation note: `src/services/AppCheckService.ts`, `App.tsx`, and the profile callable hardening are complete and covered by focused Jest plus TypeScript. Verification command: `pnpm exec jest src/services/__tests__/AppCheckService.test.ts firebase-functions/src/__tests__/profile.test.ts --runInBand` plus `pnpm exec tsc --noEmit --pretty false`. Keep this checklist item open until the Firebase Console providers and live-device verification are finished.
  - 2026-06-01 verification rerun: the same focused App Check/profile checks were rerun in this pass and stayed green, so the repo-side work remains complete while the Firebase Console activation and live-device validation stay external.

### Legal and store compliance tasks

- [x] Verify localized legal and support pages locally
  - App code is wired for `https://www.roobsworld.com` in all supported app languages.
  - The 2026-05-23 local reachability check passed for all 119 URLs at `http://localhost:3000/riddle-quest/{language}`.
  - Production deploy from `E:\portfolio` was attempted with `pnpm dlx vercel@latest deploy --prod --yes`, but Vercel blocked it because the team/account is suspended pending a valid payment method.
  - 2026-06-01 live HEAD checks against the canonical hosted pages still returned `404` for `/privacy-policy`, `/terms-of-use`, `/support`, `/account-deletion`, `/data-export`, and `/third-party-licenses`, so the blocker remains live production reachability rather than repo-local URL construction.
  - Live deployment is unavailable at the moment, so the `www.roobsworld.com` links are assumed valid once the verified local site can be deployed.
  - Keep [legal-deploy-pages-prompt.txt](legal-deploy-pages-prompt.txt) for the eventual deploy.
  - Required hosted page types:
    - Privacy Policy
    - Terms of Use
    - Licenses / third-party notices
    - Account deletion request
    - Data export request
    - Support
  - URL format: `/riddle-quest/{language}`, `/privacy-policy`, `/terms-of-use`, `/account-deletion`, `/data-export`, `/third-party-licenses`, and `/support`.
  - Supported hosted languages: `en`, `es`, `pt`, `fr`, `de`, `ja`, `ko`, `zh`, `hi`, `ru`, `tr`, `ar`, `id`, `it`, `nl`, `pl`, `vi`.
  - `src/constants/legal.ts` already generates these localized `www.roobsworld.com` paths.
  - Do not keep local Markdown copies of hosted legal pages in this repository.
  - Deferred until deployment is available: live 119-URL matrix verification and live on-device link verification from Sign Up and Settings.

- [ ] Enter final store-console legal/privacy disclosures
  - This is the only active legal/store checklist item while live deployment is unavailable.
  - Use the locally verified `www.roobsworld.com/riddle-quest/{language}` URL plan as the intended production URL set.
  - Use `https://www.roobsworld.com/riddle-quest/en/privacy-policy` as the canonical privacy policy URL where a store console requires one URL.
  - Drafts are ready in `docs/app-store-privacy-disclosures.md` and `docs/google-play-data-safety.md`; the remaining work is external console entry.

- [ ] Complete Apple App Privacy
  - Use [docs/app-store-privacy-disclosures.md](docs/app-store-privacy-disclosures.md) as the draft.
  - Complete App Privacy in App Store Connect.
  - Confirm the answers match the final production SDK list, analytics configuration, ads configuration, auth providers, crash reporting, messaging, purchases, and backend processing.
  - Re-review after any SDK or tracking setting changes.
  - This remains blocked on App Store Connect access and final submission review.

- [ ] Complete Google Play Data Safety
  - Use [docs/google-play-data-safety.md](docs/google-play-data-safety.md) as the draft.
  - Complete Data Safety in Play Console.
  - Confirm the answers match the final production SDK list, analytics configuration, ads configuration, auth providers, crash reporting, messaging, purchases, and backend processing.
  - Re-review after any SDK or tracking setting changes.
  - This remains blocked on Play Console access and final submission review.

- [x] Make the ATT/ad tracking release decision
  - Use [docs/att-review.md](docs/att-review.md).
  - Choose one release posture:
    - Keep tracking disabled, do not access IDFA, and confirm SDK dashboards match the no-tracking setup.
    - Or add an ATT consent flow before any tracking SDK can access IDFA or cross-app tracking data.
  - If tracking is enabled, gate ad personalization and tracking SDK initialization on consent and update App Store privacy answers.
  - Decision recorded: ship with the no-tracking posture for the current release, keep personalized ads and cross-app tracking disabled, and do not access IDFA unless a future release explicitly adds ATT consent.

### Account deletion implementation tasks

- [x] Add the profile modal delete account entry point
  - Implemented in `src/components/modals/settings/FullProfileDetailsModal.tsx`.
  - The "Delete Account" button appears at the bottom of the full profile modal actions.
  - The button is disabled while deletion is in progress or when profile data is unavailable.
  - Focused test coverage exists in `src/components/modals/settings/__tests__/FullProfileDetailsModal.test.tsx`.

- [x] Add the confirmation modal
  - Implemented in `src/components/modals/settings/DeleteAccountConfirmationModal.tsx`.
  - The modal opens after tapping "Delete Account" and supports cancel/confirm actions.
  - The modal uses destructive confirm styling, a loading label, and content-sized layout rather than the full profile sheet height.
  - Guest users can access the same confirmation path.

- [x] Add the Firebase deletion Function
  - Implemented as the `deleteAccount` callable in `firebase-functions/src/userManagement.ts`.
  - Exported from `firebase-functions/src/index.ts`.
  - Requires `request.auth` and always deletes data for `request.auth.uid`, ignoring any client-supplied user id.
  - Deletes the user's Firestore profile subtree, leaderboard document, user-owned `purchaseAnalytics` and `notificationHistory` documents, avatar/export storage prefixes, and Firebase Auth user.
  - Handles `auth/user-not-found` as a successful idempotent retry case.
  - Uses Firebase App Check enforcement on the callable.
  - Focused backend test coverage exists in `firebase-functions/src/__tests__/userManagement.test.ts`.

- [x] Wire the client flow
  - The confirmation modal calls `getCallableFunction("deleteAccount")`.
  - On success, the profile modal closes and `logout()` runs to clear the local session.
  - On failure, the app keeps the user signed in and shows the existing info-modal error message.
  - Focused UI tests cover open, cancel, confirm, loading, success/logout, and failure/no-logout behavior.

- [x] Verify account deletion end to end
  - Existing emulator evidence covers guest profile discoverability, confirmation modal open, and cancel path.
  - Evidence recorded in `docs/android-emulator-firebase-qa-plan.html` references screenshots `79-continue-delete-account-confirmation.png` and `80-continue-delete-account-cancelled.png`.
  - The complete account-deletion checklist is now closed in `docs/issues/0001-android-emulator-firebase-qa-plan.md`, which records the provider-auth destructive confirm-path evidence, Firebase cleanup, storage-prefix checks, and re-sign-in proof.
  - Focused source verification remains green in `src/components/modals/settings/__tests__/DeleteAccountConfirmationModal.test.tsx`, `src/components/modals/settings/__tests__/FullProfileDetailsModal.test.tsx`, and `firebase-functions/src/__tests__/userManagement.test.ts`.
  - No extra simulator pass was needed because the existing emulator evidence already captures the guest and provider-auth destructive paths.

## Features

- **Riddle-based Gameplay:** Guess 5-letter answers to intriguing riddles within 6 attempts.
- **Multiple Game Modes:**
  - Challenge Mode: A new daily riddle.
  - Classic Mode: Sequential levels with increasing difficulty.
- **User Authentication:** Secure login and sign-up using Firebase Auth (Google, Email/Password).
- **Persistent User Data:** Game progress, stats, and coin balance stored in Firestore.
- **In-App Purchases:** Purchase coins to get hints.
- **Customizable Profile:** User avatars and detailed game statistics.
- **Accessibility:** Designed with accessibility features like VoiceOver/TalkBack support and color-blind friendly patterns.

## Technologies Used

- **Frontend:** React Native, TypeScript, NativeWind (Tailwind CSS for React Native)
- **State Management:** React Context API or Zustand
- **Caching:** AsyncStorage or MMKV
- **Animations:** Reanimated & Gesture Handler
- **Sound:** expo-av
- **Haptics:** expo-haptics
- **Backend:** Firebase (Authentication, Firestore, Storage, Cloud Functions)
- **Data Storage:** Firestore (riddles, user data, game state)
- **IAP:** `react-native-iap`
- **Image Picker:** `react-native-image-picker`
- **Testing:** Jest (Unit), Detox (E2E)

## Getting Started

### Prerequisites

- Node.js & npm/yarn
- React Native development environment setup (see React Native documentation for iOS and Android setup)
- Firebase project setup and configuration files added to the project.

### Installation

1. Clone the repository:
   ```bash
   git clone <repository_url>
   cd riddle-wordle-clone
   ```
2. Install dependencies:
   ```bash
   npm install
   # or yarn install
   ```

### Running the Project

```bash
npm start
# or yarn start
```

Then, run on iOS or Android emulator/device:

```bash
npm run ios
# or yarn ios
```

```bash
npm run android
# or yarn android
```

## Available Scripts

Run these commands with `pnpm run <script>`, except `start`, `android`, `ios`, and `web`, which can also be run as `pnpm <script>`.

| Script                         | Description                                                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`                        | Starts the Expo development server for the custom dev client.                                                                                            |
| `start:android:emulator`       | Starts the Expo dev-client server for Android emulator testing, using emulator-friendly host/proxy settings on port `8081` and clearing the Metro cache. |
| `start:debug`                  | Starts the Expo dev-client server with `EXPO_DEBUG=true`, clears the Metro cache, and uses port `8081`.                                                  |
| `android`                      | Builds and runs the Android app through Expo with `GRADLE_USER_HOME` set to the local `.gradle-local` directory.                                         |
| `android:debug`                | Builds and runs the Android app with Expo debug logging enabled and the local Gradle home.                                                               |
| `android:assemble:emulator`    | Runs the Android emulator compatibility script in build mode with a 600-second timeout.                                                                  |
| `qa:android:compat`            | Runs the Android emulator compatibility QA script.                                                                                                       |
| `qa:android:emulators`         | Runs Android emulator health checks, including lock cleanup, with a 300-second timeout.                                                                  |
| `ios`                          | Builds and runs the iOS app through Expo.                                                                                                                |
| `web`                          | Starts the Expo web development server.                                                                                                                  |
| `lint`                         | Runs ESLint across JavaScript and TypeScript files using the legacy ESLint config mode, applying automatic fixes.                                        |
| `test`                         | Runs the Jest test suite with `NODE_ENV=test`.                                                                                                           |
| `test:rn`                      | Runs Jest against tests under `src`.                                                                                                                     |
| `test:watch`                   | Runs Jest in watch mode.                                                                                                                                 |
| `test:coverage`                | Runs Jest and collects coverage.                                                                                                                         |
| `test:coverage:game`           | Runs the game coverage check script.                                                                                                                     |
| `test:coverage:project`        | Runs the project coverage check script.                                                                                                                  |
| `setup:tests`                  | Runs the full test setup command.                                                                                                                        |
| `test:setup:all`               | Installs dependencies with the frozen lockfile and prebuilds the Android native project.                                                                 |
| `test:android:matrix`          | Runs Android matrix coverage checks, unit tests, emulator assembly, emulator health checks, and the emulator matrix run.                                 |
| `test:android:matrix:coverage` | Verifies that the Android emulator matrix coverage configuration is complete.                                                                            |
| `test:android:matrix:unit`     | Runs the React Native Jest tests serially for the Android matrix.                                                                                        |
| `test:android:matrix:run`      | Executes the Android emulator matrix runner script.                                                                                                      |
| `check:no-any`                 | Checks the codebase for disallowed TypeScript `any` usage.                                                                                               |
| `test:precommit`               | Runs the pre-commit validation script.                                                                                                                   |
| `check:rn-upgrade`             | Runs React Native upgrade guardrail checks.                                                                                                              |
| `baseline:report`              | Generates the baseline report used during upgrade validation.                                                                                            |
| `validate:upgrade`             | Runs React Native upgrade checks, linting, and React Native tests serially.                                                                              |
| `prepare`                      | Installs Husky git hooks during package installation.                                                                                                    |

### Docs Task List Generator

Use `scripts/generate-docs-tasks-html.js` to rebuild the consolidated docs task index:

```bash
node scripts/generate-docs-tasks-html.js
```

The script scans the `docs/` folder and writes `docs/tasks.html`. It extracts markdown checklist items, HTML checkbox lists, issue-register next actions, and explicit status notes such as `TODO`, `IN_PROGRESS`, `BLOCKED`, `UNREACHABLE`, `SKIPPED`, and `FAIL`. The generated HTML groups tasks by source document, links back to each source, and includes filters for all, open, todo, blocked, and done tasks.

Run it after editing task-bearing docs so `docs/tasks.html` stays current. The generated file intentionally excludes itself from the scan.

### Android Emulator Test Matrix

Use the Android matrix command to run the on-emulator suite across the supported AVDs one by one:

```bash
pnpm run test:android:matrix
```

The command runs these emulators sequentially:

- `rq_pixel_4a_api_36_1`
- `rq_pixel_7_api_36_1`
- `rq_pixel_8_pro_api_36_1`
- `rq_pixel_fold_outer_api_36_1`
- `rq_pixel_fold_unfolded_api_36_1`
- `rq_small_tablet_api_36_1`
- `rq_large_tablet_api_36_1`

Before the first run, set up the test environment:

```bash
pnpm run setup:tests
```

If Android Studio shows friendly names with spaces, use the underscore AVD IDs above for command-line runs.

Matrix evidence is archived under `device-matrix-test/DD-MM-YYYY/<device>/images/` and `device-matrix-test/DD-MM-YYYY/<device>/logs/`, with shared runner logs stored under the `shared` device folder for that date.

## Memory Bank

This project utilizes a `memory-bank` directory containing detailed documentation on project context, technical decisions, system patterns, and progress. Refer to these documents (`projectbrief.md`, `productContext.md`, `techContext.md`, `systemPatterns.md`, `activeContext.md`, `progress.md`) for in-depth information.

## Funding Pack

Funding materials for the pre-launch beta are maintained in `docs/funding/`. This pack implements the under-GBP 30k funding plan for Riddle Quest/Qwordly, including the one-page summary, pitch deck outline, GBP 24,500 budget, UKGF grant checklist, beta validation plan, publisher/investor outreach scripts, pitch video script, outreach tracker, and 90-day execution plan. Start with `docs/funding/README.md`.

## Contributing

(Contribution guidelines to be added later)

## License

(License information to be added later)

# Environment Variables Setup

## Prerequisites

Before running the Riddle Quest app, you need to configure the environment variables with your actual API keys and configuration values.

## Setup Instructions

1. **Copy the environment template:**

   ```bash
   cp .env.example .env
   ```

2. **Fill in your actual values in the `.env` file:**

### Required Environment Variables

#### OpenAI Configuration

- `OPENAI_API_KEY` - Your OpenAI API key for riddle generation

#### Firebase Configuration

- `FIREBASE_API_KEY` - Firebase Web API key from Firebase Console
- `FIREBASE_APP_ID` - Firebase App ID from Firebase Console
- `FIREBASE_AUTH_DOMAIN` - Firebase Auth domain (usually `{project-id}.firebaseapp.com`)
- `FIREBASE_MESSAGING_SENDER_ID` - Firebase Messaging Sender ID
- `FIREBASE_PROJECT_ID` - Firebase Project ID
- `FIREBASE_STORAGE_BUCKET` - Firebase Storage bucket name

#### Google Authentication

- `GOOGLE_WEB_CLIENT_ID` - Google Sign-In Web Client ID from Firebase Console

## Seeding In-App Purchase Product Pricing

This repo includes a helper script to seed the Firestore `productPricing` collection with the canonical coin-pack catalog used by the client and backend.

Prerequisites:

- A Google service account JSON with Firestore write permissions. Recommended IAM role: `roles/datastore.user` (Cloud Datastore User). For convenience or broader access use `roles/datastore.owner` or `roles/firebase.admin`.
- Set the environment variable `GOOGLE_APPLICATION_CREDENTIALS` to point at the service account JSON.

From the repository root run:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="e:\path\to\your-service-account.json"
node scripts/seedProductPricing.js
```

What it does:

- Upserts documents under `productPricing/{productId}` for the 6 coin packs (`com.roobsworld.riddlequest.coinpack1` ... `coinpack6`).
- Each document contains `coins`, `productKey`, `sortOrder`, `featuredOrder`, and `regionalPrices` values used by the app and backend.

Use this when preparing a QA or staging project so the client `CoinShop` can read server-side pricing instead of falling back to a local list.

#### Facebook Authentication

- `FACEBOOK_APP_ID` - Facebook App ID from Facebook Developers Console
- `FACEBOOK_APP_SECRET` - Facebook App Secret from Facebook Developers Console
- `FACEBOOK_CLIENT_TOKEN` - Facebook Client Token from Facebook Developers Console

#### In-App Purchases (Optional)

- `APPLE_SHARED_SECRET` - Apple App Store shared secret for receipt validation
- `GOOGLE_SERVICE_ACCOUNT` - Google Play service account JSON for receipt validation

#### EAS Build Configuration

- `EAS_PROJECT_ID` - Expo Application Services project ID

## Security Notes

- **Never commit the `.env` file to version control** - it contains sensitive API keys
- The `.env` file is already included in `.gitignore` for protection
- Use different environment files for different deployment environments (development, staging, production)
- Regularly rotate your API keys and secrets for security

## Getting API Keys

### Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing project
3. Add your app (iOS/Android/Web)
4. Copy the configuration values from the Firebase config

### OpenAI Setup

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an account and add payment method
3. Generate an API key in the API keys section

### Facebook Setup

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or select existing app
3. Add Facebook Login product
4. Copy the App ID, App Secret, and Client Token

## Troubleshooting

If you encounter authentication or API issues:

1. **Verify all environment variables are set correctly**
2. **Check that your API keys are valid and not expired**
3. **Ensure your Firebase project has the correct services enabled**
4. **Verify your Facebook app is in development or live mode as needed**
5. **Check the console logs for specific error messages about missing configuration**

The app will show warning messages in the console if environment variables are missing or set to placeholder values.
