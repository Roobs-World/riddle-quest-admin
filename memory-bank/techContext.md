# Tech Context: Riddle Wordle Clone

## 1. Core Technologies

- **Programming Language:** TypeScript
- **Framework/Library:** React Native (version 0.75+)
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **State Management:** React Context API or Zustand (decision to be finalized based on complexity)
- **Navigation:** React Navigation (assumed, standard for RN)
- **Persistent Caching (Client-side):** AsyncStorage or MMKV (decision based on performance needs and ease of use)

## 2. Backend & Cloud Services

- **Backend-as-a-Service (BaaS):** Firebase
  - **Authentication:** Firebase Authentication (Google Sign-In, Facebook Login, Email/Password, Password Reset, Anonymous Auth)
  - **Database:** Firestore (for user stats, game progress, coin balances, avatar URLs, riddle levels)
  - **Storage:** Firebase Storage (for user-uploaded avatars)
  - **Serverless Functions:** Firebase Cloud Functions (for generating new riddles)
- **Initial Data Source:** Google Sheets (for the first 100+ riddle levels)
- **Scripting for Sheets Integration:** Google Apps Script (to sync riddles from Sheets to Firestore)

## 3. Key Libraries & Dependencies

- **In-App Purchases:** `react-native-iap`
- **Image Picker:** `react-native-image-picker` (for avatar uploads)
- **Animations:** `react-native-reanimated`, `react-native-gesture-handler`
- **Sound Effects:** `expo-av`
- **Haptic Feedback:** `react-native-haptic-feedback`
- \*\*Testing:
  - Unit Testing:\*\* Jest
  - **End-to-End (E2E) Testing:** Detox

## 4. Development Setup & Environment

- **Node.js & npm:** Use npm for package management.
- **React Native CLI:** For project initialization and management.
- **IDE:** (User's choice, e.g., VS Code with relevant extensions for React Native, TypeScript, ESLint, Prettier).
- **Emulators/Simulators:** Android Studio Emulator & iOS Simulator (Xcode).
- **Firebase CLI:** For managing Firebase projects and deployments.
- **Google Cloud SDK (gcloud):** Potentially for managing Cloud Functions if not solely through Firebase CLI.

## 5. Technical Constraints & Considerations

- **Target Platforms:** iOS 16+ and Android 10+.
- **Performance Requirements:**
  - Input latency: <100 ms.
  - Cold start time: <2 seconds.
- **Avatar Uploads:** PNG/JPEG formats only, file size limit of ≤5 MB.
- **Riddle Structure:** Riddles leading to 5-letter answers.
- **Security:** Server-side validation for in-app purchases is critical.
- **Offline Support:** Basic offline caching of game state/levels could be considered for Classic Mode, but primary functionality relies on Firebase connectivity.
- **Scalability:** Firebase services are generally scalable, but efficient data modeling in Firestore and optimized Cloud Functions will be important for cost and performance as user base grows.
- **Dynamic Riddle Generation:** The Cloud Function for new riddles needs a robust mechanism to ensure quality and uniqueness of generated riddles (e.g., integrating with a dictionary API, NLP techniques, or a pre-vetted word list for answers).

## 6. Tool Usage Patterns

- **Version Control:** Git, with a repository hosted on a platform like GitHub/GitLab/Bitbucket.
- **Code Formatting & Linting:** ESLint and Prettier configured for TypeScript and React Native.
- **Build & Bundling:** Metro (React Native's default bundler).
- **Debugging:** React Native Debugger, Flipper, or IDE-integrated debuggers.
- **CI/CD:** (To be considered) Setting up a CI/CD pipeline (e.g., GitHub Actions, Fastlane) for automated builds, tests, and deployments.

## 7. Accessibility Implementation

- Proper use of `accessible`, `accessibilityLabel`, `accessibilityHint`, `accessibilityRole`, `accessibilityState` props for React Native components.
- Testing with VoiceOver (iOS) and TalkBack (Android).
- Implementing color-blind friendly patterns for guess feedback (e.g., distinct patterns or icons in addition to color).
- Allowing for adjustable text size where feasible, respecting system-level font size settings if possible.
