# Tech Context

This document details the technologies, development setup, technical constraints, dependencies, and tool usage patterns for the Qwordly project.

## Technologies Used:

- **React Native**: 0.84.1 - Core mobile framework for iOS and Android
- **Expo**: SDK 55 - Development platform and toolchain
- **TypeScript**: 5.9.3 - Type-safe JavaScript development
- **React**: 19.2.4 - JavaScript library for building user interfaces
- **NativeWind**: 4.2.2 - Tailwind CSS for React Native styling

### Bundling & Development

- **Metro**: 0.84.2 - React Native bundler for JavaScript transformation and bundling
- **Expo CLI**: 55.x - Command-line tool for Expo development
- **PNPM**: 10.11.0 - Fast, disk space efficient package manager

### Animation & UI

- **React Native Reanimated**: 4.2.2 - High-performance animations
- **React Native Gesture Handler**: 2.30.0 - Touch gesture management
- **Matter.js**: 0.20.0 - 2D physics engine for animations
- **React Native SVG**: 15.15.3 - SVG support for React Native
- **Three.js**: 0.183.2 - 3D rendering for solar system visualization
- **@react-three/fiber**: 9.5.0 - React renderer for Three.js
- **@react-three/drei**: 10.7.7 - Helpers for react-three-fiber

### Backend Technologies

- **Firebase**: Authentication, Firestore, Cloud Functions (v2, using `process.env` for configuration), Storage
- **Node.js**: Runtime for Firebase Functions
- **TypeScript**: Type-safe server-side development
- **Firebase Admin SDK**: 13.7.0 - Server-side Firebase operations
- **OpenAI**: 6.25.0 - AI/ML integration for riddle generation with enhanced validation

### Testing & Quality

- **Jest**: 30.2.0 - JavaScript testing framework
- **ts-jest**: 29.4.6 - TypeScript support for Jest
- **@testing-library/react-native**: 13.3.3 - React Native component testing
- **ESLint**: 9.16.0 - Code linting and quality enforcement
- **Husky**: 9.1.7 - Git hooks for pre-commit test enforcement
- **Test Coverage**: 2,497 passing tests (2,111 RN + 386 Firebase Functions), 0 failures

### Data Validation & Quality

- **Zod**: 4.3.6 - TypeScript-first schema validation
- **Answer Validation**: Strict regex validation (`/^[a-z]+$/`) ensuring only lowercase letters in riddle answers
- **Punctuation Prevention**: Enhanced OpenAI prompts and server-side validation preventing all punctuation marks
- **Content Quality**: 7-character maximum answer length with comprehensive validation rules

### Native Integrations

- **React Native Firebase**: 23.8.6 - Native Firebase SDK integration (modular API)
- **Google Sign-In**: 16.1.2 - Google authentication
- **Facebook SDK**: 13.4.3 - Facebook integration
- **React Native IAP**: 14.7.12 - In-app purchases

### Additional Libraries

- **Axios**: 1.13.6 - HTTP client for API requests

### Sound & Haptics

- **Sound:** expo-audio (SDK 55; migrated from expo-av; supports audio fading)
- **Haptics:** react-native-haptic-feedback

## Development Setup:

- **Node.js**: Compatible version installed
- **PNPM**: Package manager configured
- **Expo CLI**: Installed and configured for project management
- **Firebase CLI**: Installed for backend deployment
- **TypeScript**: Configured for both client and server development
- **Metro Bundler**: Configured with custom transformers for SVG and NativeWind

## Technical Constraints:

- **Expo SDK 55**: New Architecture mandatory; expo-av removed (use expo-audio)
- **Metro Bundler**: Module resolution changes requiring compatibility adjustments
- **Firebase Platform**: Function execution time and Firestore query limitations. Firebase Functions v2 requires configuration via environment variables (`process.env`) instead of `functions.config()`.
- **React Native 0.84.1**: New Architecture (Fabric/TurboModules) mandatory
- **iOS 16+/Android 10+**: Minimum platform version requirements
- **Android Edge-to-Edge**: Enabled for future Android 16+ compatibility (targetSdkVersion 36+)
- **TypeScript Module Resolution**: Using "bundler" resolution for Metro compatibility

## Dependencies:

- **Frontend**: Refer to main `package.json` for React Native app dependencies
- **Backend**: Refer to `firebase-functions/package.json` for server-side dependencies
- **Development**: Comprehensive DevDependencies for TypeScript, testing, and build tools

## Tool Usage Patterns:

- **Development Commands**:

  - `npx expo start` - Start development server (currently blocked by Metro issue)
  - `npx expo start --clear` - Start with cache clearing
  - `pnpm install` - Install dependencies
  - `npx expo customize metro.config.js` - Generate/customize Metro config

- **Testing Commands**:

  - `pnpm run test` - Run Jest tests for React Native app (src/ only)
  - `pnpm run test:precommit` - Full pre-commit suite: lint + RN tests + Firebase Functions tests
  - `pnpm run lint` - ESLint code quality checks
  - `cd firebase-functions && pnpm run test` - Firebase Functions unit tests (excludes *.it.test.ts)
  - **Pre-commit**: Husky runs `test:precommit` before every commit; use `git commit --no-verify` to bypass
  - **PRE_COMMIT_SKIP_LINT=1**: Skips lint step (e.g. for quick test-only runs)

- **Build & Deploy Commands**:
  - `npx expo build:android` - Build Android APK
  - `npx expo build:ios` - Build iOS app
  - `npm run deploy` - Deploy Firebase Functions (in firebase-functions directory)

## Configuration Files:

- **metro.config.js**: Metro bundler configuration with NativeWind and SVG support
- **babel.config.js**: Babel transpilation configuration
- **jest.config.js**: Jest testing framework configuration
- **tsconfig.json**: TypeScript compiler configuration with "bundler" module resolution for Metro compatibility
- **app.config.js**: Expo app configuration and build settings with edge-to-edge enabled for Android
- **firebase.json**: Firebase services configuration
- **.env files (recommended)**: For managing Firebase Functions environment variables locally (e.g., `.env.local`, `.env.dev`, `.env.prod`). Ensure these are gitignored. Environment variables include `OPENAI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT` (JSON string for IAP), `APPLE_SHARED_SECRET`, `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_CLIENT_TOKEN`.

## Core Technologies:

### **Testing Infrastructure**:

**Framework**: Jest 30.2.0 with TypeScript support  
**Configuration**: Dual testing — React Native (preset: `react-native`) and Firebase Functions (ts-jest)  
**Results**: 2,497 tests passing, 0 failures (2,111 RN + 386 Firebase Functions)  
**Firebase Functions Coverage**: 61.65% overall, 11 files at 100% line coverage  
**Pre-commit**: Husky enforces `pnpm run test:precommit` (lint + all tests) before every commit

**Test Categories**:

- **React Native**: Component, hook, and service tests via @testing-library/react-native
- **Firebase Functions**: Unit tests with Jest mocks; integration tests against live Firebase
- **Error Handling**: Comprehensive edge case and error scenario coverage

### **Development Environment**:
