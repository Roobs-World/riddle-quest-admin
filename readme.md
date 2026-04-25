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
