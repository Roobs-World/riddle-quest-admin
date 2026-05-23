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

adb install path/to/app.apk

## RN 0.85 Upgrade Notes

- Runtime now targets React Native `0.85.0` with Expo SDK 56 canary.
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
  - Keep disabled until RN `0.85.1+` is available and experimental channel is enabled.

## Project Overview

This is a mobile game that combines the popular Wordle-style gameplay with challenging riddles. Built using React Native and Firebase, the game features user authentication, multiple game modes, in-app purchases for a coin system, and customizable user profiles.

## Marketing Kit

The 90-day pre-launch marketing package lives in [docs/marketing/README.md](docs/marketing/README.md). It implements the multilingual launch plan for Riddle Quest with store metadata, ASO experiments, creator outreach templates, a content calendar, press kit copy, tracking/KPI definitions, and a static pre-launch landing page at [docs/marketing/prelaunch-landing-page.html](docs/marketing/prelaunch-landing-page.html).

## Release Readiness Checklist

Use this checklist to track the manual security, privacy, store, and account-deletion work that still needs to happen before release. Keep evidence for each completed task: date completed, person responsible, console screenshots where useful, deployed versions, and any follow-up notes.

### Off-repo security tasks

- [ ] Rotate exposed credentials
  - Follow [docs/credential-rotation-runbook.md](docs/credential-rotation-runbook.md).
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

- [ ] Enable Firebase App Check enforcement
  - Configure valid Firebase App Check providers for both iOS and Android in the Firebase Console.
  - Confirm the released clients can request and send App Check tokens.
  - Enable enforcement for sensitive deployed callable Functions only after client verification.
  - Smoke test callable Function flows from real iOS and Android builds after enforcement is enabled.

### Legal and store compliance tasks

- [x] Verify localized legal and support pages locally
  - App code is wired for `https://www.roobsworld.com` in all supported app languages.
  - The 2026-05-23 local reachability check passed for all 119 URLs at `http://localhost:3000/riddle-quest/{language}`.
  - Production deploy from `E:\portfolio` was attempted with `pnpm dlx vercel@latest deploy --prod --yes`, but Vercel blocked it because the team/account is suspended pending a valid payment method.
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

- [ ] Complete Apple App Privacy
  - Use [docs/app-store-privacy-disclosures.md](docs/app-store-privacy-disclosures.md) as the draft.
  - Complete App Privacy in App Store Connect.
  - Confirm the answers match the final production SDK list, analytics configuration, ads configuration, auth providers, crash reporting, messaging, purchases, and backend processing.
  - Re-review after any SDK or tracking setting changes.

- [ ] Complete Google Play Data Safety
  - Use [docs/google-play-data-safety.md](docs/google-play-data-safety.md) as the draft.
  - Complete Data Safety in Play Console.
  - Confirm the answers match the final production SDK list, analytics configuration, ads configuration, auth providers, crash reporting, messaging, purchases, and backend processing.
  - Re-review after any SDK or tracking setting changes.

- [ ] Make the ATT/ad tracking release decision
  - Use [docs/att-review.md](docs/att-review.md).
  - Choose one release posture:
    - Keep tracking disabled, do not access IDFA, and confirm SDK dashboards match the no-tracking setup.
    - Or add an ATT consent flow before any tracking SDK can access IDFA or cross-app tracking data.
  - If tracking is enabled, gate ad personalization and tracking SDK initialization on consent and update App Store privacy answers.

### Account deletion implementation tasks

- [ ] Add the profile modal delete account entry point
  - Add a "Delete account" button at the bottom of the profile modal.
  - Keep the visual language consistent with the existing modal buttons and destructive actions.
  - Make sure the button remains reachable on small screens and does not crowd existing profile actions.

- [ ] Add the confirmation modal
  - Show an "Are you sure?" confirmation modal after the delete button is tapped.
  - Reuse the existing modal background, animation, typography, and button treatment used elsewhere.
  - Let the modal height fit its content instead of forcing the full profile modal height.
  - Include a cancel action and a clearly destructive confirm action.

- [ ] Add the Firebase deletion Function
  - Implement a callable Firebase Function for hard account deletion.
  - Require an authenticated user context.
  - Delete Firebase Auth user data and owned Firestore/Storage data for the caller.
  - Include the guest cleanup path for anonymous users.
  - Make the function idempotent enough that retrying after a partial failure does not corrupt state.
  - Avoid logging personal data, tokens, or raw deletion payloads.

- [ ] Wire the client flow
  - Call the deletion Function from the confirmation modal.
  - Show loading, success, and failure states.
  - On success, clear local user/session state and return the app to the signed-out or onboarding flow.
  - On failure, keep the user signed in and show a recoverable error message.

- [ ] Verify account deletion
  - Test the flow for an email/password user, social-login user where available, and anonymous guest user.
  - Confirm Firestore user-owned documents are deleted.
  - Confirm Firebase Storage avatar files are deleted.
  - Confirm the Firebase Auth user is removed.
  - Confirm local guest/user state is cleared on the device.
  - Verify the UI in the simulator when local Expo MCP capabilities are available.

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

## Memory Bank

This project utilizes a `memory-bank` directory containing detailed documentation on project context, technical decisions, system patterns, and progress. Refer to these documents (`projectbrief.md`, `productContext.md`, `techContext.md`, `systemPatterns.md`, `activeContext.md`, `progress.md`) for in-depth information.

## Funding Pack

Funding materials for the pre-launch beta are maintained in `docs/funding/`. This pack implements the under-GBP 30k funding plan for Riddle Quest/Qwordly, including the one-page summary, pitch deck outline, GBP 24,500 budget, UKGF grant checklist, beta validation plan, publisher/investor outreach scripts, pitch video script, outreach tracker, and 90-day execution plan. Start with `docs/funding/README.md`.

## TODO

- [ ] Update team member website links in the Credits screen (`src/screens/CreditsScreen.tsx`)
  - Craig Beswetherick - Lead Developer & Game Design
  - Reuben Beswetherick - Inspiration
  - Thomas Lemrond - Game Designer, Publisher, Overall Hero
  - Gavin Harrison - Sound Design
  - Nathalia - Design

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
