npx eas-cli build --profile development --platform android

expo run:android

use firebase functions:config:get to return the config settings used

## Project Overview

This is a mobile game that combines the popular Wordle-style gameplay with challenging riddles. Built using React Native and Firebase, the game features user authentication, multiple game modes, in-app purchases for a coin system, and customizable user profiles.

## Features

- **Riddle-based Gameplay:** Guess 5-letter answers to intriguing riddles within 6 attempts.
- **Multiple Game Modes:**
  - Challenge Mode: A new daily riddle.
  - Classic Mode: Sequential levels with increasing difficulty.
- **User Authentication:** Secure login and sign-up using Firebase Auth (Google, Email/Password).
- **Persistent User Data:** Game progress, stats, and coin balance stored in Firestore.
- **In-App Purchases:** Purchase coins to skip levels or get hints.
- **Customizable Profile:** User avatars and detailed game statistics.
- **Accessibility:** Designed with accessibility features like VoiceOver/TalkBack support and color-blind friendly patterns.

## Technologies Used

- **Frontend:** React Native, TypeScript, NativeWind (Tailwind CSS for React Native)
- **State Management:** React Context API or Zustand
- **Caching:** AsyncStorage or MMKV
- **Animations:** Reanimated & Gesture Handler
- **Sound:** expo-av
- **Haptics:** react-native-haptic-feedback
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

## Contributing

(Contribution guidelines to be added later)

## License

(License information to be added later)
