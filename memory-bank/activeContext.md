# Active Context: Riddle Wordle Clone

## 1. Current Work Focus

- **Authentication UI Implementation:** Building the user interface for Landing, Login, Sign Up, and Forgot Password screens based on provided designs.
- **Authentication Logic Implementation:** Implementing the core logic for user sign-up, login, password reset, and social sign-in using Firebase Auth.
- **NativeWind Integration:** Ensuring NativeWind is correctly configured for styling across the application, including TypeScript support and custom theme elements.

## 2. Recent Changes & Decisions

- **Memory Bank Established:** Core documentation remains up-to-date.
- **Architectural Outline:** Client-server architecture using React Native and Firebase confirmed.
- **Authentication Screens UI Created:** `LandingScreen.tsx`, `LoginScreen.tsx`, and `SignUpScreen.tsx` created in `src/screens/auth/` with basic UI structure matching screenshots. Replaced specific `TextInput` uses with a new `ReusableTextInput` component for better modularity.
- **NativeWind Setup Complete:** Successfully installed and configured NativeWind, `babel.config.js`, `tailwind.config.js` (with custom colors: `primary-orange` and `cream-light`), and TypeScript typings (`src/types/nativewind.d.ts`).
- **App.tsx Styling Migrated:** Moved initial container styles from `StyleSheet` in `App.tsx` to NativeWind classes.
- **Discovered Discrepancy:** Noted that "Continue with Microsoft" option in screenshots is not in the original `projectbrief.md`. This needs clarification for MVP scope.
- \*\*Added a "Confirm Password" field to `SignUpScreen.tsx` and updated `src/constants/AppStrings.ts`.
- \*\*Created basic UI for Forgot Password Screen (`src/screens/auth/ForgotPasswordScreen.tsx`) with padlock icon, email input, and reset button.
- \*\*Implement password reset functionality (link from `LoginScreen.tsx` to `ForgotPasswordScreen.tsx`).
- **Implemented Firebase Email/Password Auth:** Added `signUpWithEmail`, `loginWithEmail`, and `sendPasswordResetEmail` functions in `src/services/AuthService.ts`.
- **Implemented Firebase Google Sign-In:** Added `signInWithGoogle` function in `src/services/AuthService.ts`, requiring the `@react-native-google-signin/google-signin` package.
- **Implemented Firebase Logout:** Added `logout` function in `src/services/AuthService.ts`.

## 3. Next Steps & Immediate Goals

1.  **Navigation Setup:**
    - Install `react-navigation` and its dependencies.
    - Create a basic navigation structure (e.g., an Auth stack for these new screens and a placeholder for the main app stack).
    - Integrate `LandingScreen`, `LoginScreen`, `SignUpScreen`, and `ForgotPasswordScreen` into the Auth navigation stack.
    - **Address Linter Error:** Resolve the `navigation` prop requirement on `LandingScreen` by integrating it into a navigation container.
2.  **Icon Implementation:** Replace placeholder text/view icons in auth screens with actual vector icons (e.g., using `react-native-vector-icons` or SVGs).
3.  **Firebase SDK Setup:** Ensure Firebase SDK is correctly initialized in the React Native project.
4.  **Address Persistent Linter Error:** Investigate and resolve the `UserCredential` import error in `src/services/AuthService.ts` (line 1).
5.  **Install Google Sign-In Dependency:** Install the `@react-native-google-signin/google-signin` package to resolve the import error on line 5 of `src/services/AuthService.ts`.
6.  **Implement Firebase Facebook Sign-In:** Implement Firebase Facebook Sign-In logic on `LandingScreen.tsx`.
7.  **Microsoft Sign-In (Pending Clarification):** If confirmed for MVP, implement Firebase Microsoft Sign-In logic on `LandingScreen.tsx`.
8.  **Form Validation:** Add basic client-side validation to input fields in Login and Sign Up screens.
9.  **Auth State Management:** Set up basic auth state management (e.g., using React Context) to handle user login/logout status and navigate accordingly.

## 4. Active Decisions & Considerations

- **State Management Choice:** Still leaning towards React Context for MVP for simplicity, especially for auth state.
- **Client-Side Caching:** AsyncStorage remains the initial choice.
- **Error Handling Strategy:** Begin implementing basic error display for authentication attempts (e.g., invalid credentials, email already in use).
- **Microsoft Sign-In Scope:** Awaiting clarification on whether Microsoft Sign-In is part of the MVP. If so, will need to ensure Firebase project is configured for it and necessary SDKs/logic are added.
- **Icon Library:** Decide on a specific icon library (e.g., `react-native-vector-icons` مجموعه MaterialCommunityIcons or Feather) for consistency, or prepare SVGs for custom icons if needed.
- **UserCredential Import Error:** The persistent linter error on the `UserCredential` import contradicts the official `@react-native-firebase/auth` documentation. This needs further investigation or potentially a manual override/suppression if the linter is misinterpreting the library.

## 5. Key Patterns & Preferences (Emerging)

- **Modular Development:** Auth screens are grouped in `src/screens/auth/`. Reusable UI components (like `ReusableTextInput`) are being created and placed in `src/components/`.
- **Iterative Approach:** UI first, then navigation, then logic.
- **Configuration Files:** Centralized configuration for NativeWind (`tailwind.config.js`, `babel.config.js`, `nativewind.d.ts`).
- **Clear Communication:** Updates to `progress.md` and `activeContext.md` reflect current status and next steps.
- **2024-07-27:** Created basic UI for Landing, Login, and Sign Up screens based on provided screenshots.
  - Set up NativeWind, including `babel.config.js`, `tailwind.config.js`, and TypeScript typings.
  - Identified custom colors `primary-orange` (#FDBA74) and `cream-light` (#FAF3E0) from screenshots and added to Tailwind config.
  - _Note:_ Used direct `className` prop for NativeWind styling (v4 approach) instead of `styled` HOC after encountering linter issues.
  - _Observation:_ Screenshots include "Continue with Microsoft" which was not in the original brief. This needs to be clarified for MVP scope.
  - _Decision:_ Created a `ReusableTextInput` component and integrated it into `LoginScreen.tsx` and `SignUpScreen.tsx` to follow component-based UI patterns and improve reusability.
- **2024-07-27:** Added the "Confirm Password" field to the `SignUpScreen.tsx` and updated `src/constants/AppStrings.ts` to include the necessary strings (`CONFIRM_PASSWORD_LABEL` and `CONFIRM_PASSWORD_PLACEHOLDER`).
- **2024-07-27:** Created basic UI for Forgot Password Screen (`src/screens/auth/ForgotPasswordScreen.tsx`) with padlock icon, email input, and reset button.
- **2024-07-27:** Implemented password reset functionality (link from `LoginScreen.tsx` to `ForgotPasswordScreen.tsx`).
- **2024-07-29:** Implemented Firebase email/password sign-up, login, password reset, Google Sign-In, and logout functions in `src/services/AuthService.ts`.
  - Encountered persistent linter error on `UserCredential` import (line 1) and a missing dependency error for `@react-native-google-signin/google-signin` (line 5).

## 6. Learnings & Project Insights

- NativeWind v4 styling primarily uses the `className` prop directly, and the `styled` HOC might be deprecated or less common. Ensuring correct TypeScript typings (`nativewind/types`) and Babel plugin (`nativewind/babel`) is crucial.
- Visual designs (screenshots) can sometimes introduce elements not in initial textual briefs (e.g., Microsoft login). Regular reconciliation is important.
- Linter behavior with specific library versions/imports can sometimes be unexpected and require manual investigation or workarounds.
- External dependencies like `@react-native-google-signin/google-signin` need to be explicitly installed.
