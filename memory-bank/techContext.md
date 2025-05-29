# Tech Context

## 1. Technologies Used

### Frontend Technologies

- **React Native**: 0.75.4 - Core mobile framework for iOS and Android
- **Expo**: SDK 53.0.9 - Development platform and toolchain
- **TypeScript**: 5.8.3 - Type-safe JavaScript development
- **React**: 18.2.0 - JavaScript library for building user interfaces
- **NativeWind**: 4.1.23 - Tailwind CSS for React Native styling

### Bundling & Development

- **Metro**: React Native bundler for JavaScript transformation and bundling
- **Expo CLI**: 0.24.13 - Command-line tool for Expo development
- **PNPM**: 10.11.0 - Fast, disk space efficient package manager

### Animation & UI

- **React Native Reanimated**: 3.17.4 - High-performance animations
- **React Native Gesture Handler**: 2.24.0 - Touch gesture management
- **Matter.js**: 0.20.0 - 2D physics engine for animations
- **React Native SVG**: 15.12.0 - SVG support for React Native

### Backend Technologies

- **Firebase**: Authentication, Firestore, Cloud Functions (v2, using `process.env` for configuration), Storage
- **Node.js**: Runtime for Firebase Functions
- **TypeScript**: Type-safe server-side development
- **Firebase Admin SDK**: 13.4.0 - Server-side Firebase operations
- **OpenAI**: 4.102.0 - AI/ML integration for riddle generation with enhanced validation

### Testing & Quality

- **Jest**: 29.7.0 - JavaScript testing framework
- **ts-jest**: 29.3.4 - TypeScript support for Jest
- **ESLint**: Code linting and quality enforcement
- **Prettier**: Code formatting
- **Test Coverage**: 184 passing tests across 21 test suites with 0 failures

### Data Validation & Quality

- **Zod**: 3.25.17 - TypeScript-first schema validation
- **Answer Validation**: Strict regex validation (`/^[a-z]+$/`) ensuring only lowercase letters in riddle answers
- **Punctuation Prevention**: Enhanced OpenAI prompts and server-side validation preventing all punctuation marks
- **Content Quality**: 7-character maximum answer length with comprehensive validation rules

### Native Integrations

- **React Native Firebase**: 22.2.0 - Native Firebase SDK integration
- **Google Sign-In**: 14.0.1 - Google authentication
- **AppLovin MAX**: 9.1.0 - Mobile advertising platform
- **Facebook SDK**: 13.4.1 - Facebook integration
- **React Native IAP**: 12.16.2 - In-app purchases

### Additional Libraries

- **Axios**: 1.9.0 - HTTP client for API requests

## 2. Development Environment Setup

- **Node.js**: Compatible version installed
- **PNPM**: Package manager configured
- **Expo CLI**: Installed and configured for project management
- **Firebase CLI**: Installed for backend deployment
- **TypeScript**: Configured for both client and server development
- **Metro Bundler**: Configured with custom transformers for SVG and NativeWind

## 3. Technical Constraints

- **Expo SDK 53**: Stricter package.json exports enforcement affecting some third-party libraries
- **Metro Bundler**: Module resolution changes requiring compatibility adjustments
- **Firebase Platform**: Function execution time and Firestore query limitations. Firebase Functions v2 requires configuration via environment variables (`process.env`) instead of `functions.config()`.
- **React Native 0.75.4**: New Architecture (Fabric/TurboModules) compatibility considerations
- **iOS 16+/Android 10+**: Minimum platform version requirements

## 4. Dependencies

- **Frontend**: Refer to main `package.json` for React Native app dependencies
- **Backend**: Refer to `firebase-functions/package.json` for server-side dependencies
- **Development**: Comprehensive DevDependencies for TypeScript, testing, and build tools

## 5. Tool Usage Patterns

### Development Commands

- `npx expo start` - Start development server (currently blocked by Metro issue)
- `npx expo start --clear` - Start with cache clearing
- `pnpm install` - Install dependencies
- `npx expo customize metro.config.js` - Generate/customize Metro config

### Testing Commands

- `npm run test` - Run Jest tests for React Native app
- `npm run lint` - ESLint code quality checks
- Firebase Functions testing via separate Jest configuration

### Build & Deploy Commands

- `npx expo build:android` - Build Android APK
- `npx expo build:ios` - Build iOS app
- `npm run deploy` - Deploy Firebase Functions (in firebase-functions directory)

## 6. Configuration Files

- **metro.config.js**: Metro bundler configuration with NativeWind and SVG support
- **babel.config.js**: Babel transpilation configuration
- **jest.config.js**: Jest testing framework configuration
- **tsconfig.json**: TypeScript compiler configuration
- **app.config.js**: Expo app configuration and build settings
- **firebase.json**: Firebase services configuration
- **.env files (recommended)**: For managing Firebase Functions environment variables locally (e.g., `.env.local`, `.env.dev`, `.env.prod`). Ensure these are gitignored. Environment variables include `OPENAI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT` (JSON string for IAP), `APPLE_SHARED_SECRET`, `APPLOVIN_SDK_KEY`, `APPLOVIN_INTERSTITIAL_AD_UNIT_ID`, `APPLOVIN_REWARDED_AD_UNIT_ID`, `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_CLIENT_TOKEN`.
