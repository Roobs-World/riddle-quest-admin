# Progress: Riddle Wordle Clone

## Current Date: 2024-07-27 (Update this with each significant progress entry)

## 1. What Works / Completed Features

- **Project Initialization & Planning:**
  - Memory Bank documents created (`projectbrief.md`, `productContext.md`, `techContext.md`, `systemPatterns.md`, `activeContext.md`, `progress.md`).
  - Initial project requirements and scope defined.
  - High-level architecture and technology stack choices outlined.
- **Basic Authentication Screens UI:**
  - [x] Landing Screen (`src/screens/auth/LandingScreen.tsx`) UI structure created.
  - [x] Login Screen (`src/screens/auth/LoginScreen.tsx`) UI structure created.
  - [x] Sign Up Screen (`src/screens/auth/SignUpScreen.tsx`) UI structure created.
  - [x] Forgot Password Screen (`src/screens/auth/ForgotPasswordScreen.tsx`) UI structure created with padlock icon, email input, and reset button.
- **NativeWind Setup:**
  - [x] `nativewind` and `tailwindcss` dependencies installed.
  - [x] `babel.config.js` configured for NativeWind.
  - [x] `tailwind.config.js` configured with content paths and custom project colors (`primary-orange`, `cream-light`).
  - [x] TypeScript type definitions for NativeWind (`src/types/nativewind.d.ts`) added.
- **App.tsx Styling Migration:**
  - [x] Moved initial container styles from `StyleSheet` to NativeWind classes.
- **Reusable Components:**
  - [x] Created `ReusableTextInput.tsx` component.
  - [x] Integrated `ReusableTextInput` into `LoginScreen.tsx`.
  - [x] Integrated `ReusableTextInput` into `SignUpScreen.tsx`.
  - [x] Added "Confirm Password" field to `SignUpScreen.tsx` and updated `AppStrings.ts` with necessary strings.

## 2. What's Left to Build (MVP Focus - 2 Weeks Timeline)

### Core Gameplay & UI

- **Challenge Mode:**
  - [ ] Daily riddle fetching (from Firestore).
  - [ ] 6-guess logic with 5-letter answer validation.
  - [ ] Color feedback implementation (green/yellow/gray).
  - [ ] Coin reward calculation and awarding.
  - [ ] Lock until next UTC day.
- **Classic Mode:**
  - [ ] Sequential level loading from Firestore.
  - [ ] Unlock next level logic.
  - [ ] Skip level with coins (50 coins) functionality.
- **Main Game Screen UI:**
  - [ ] Riddle text display.
  - [ ] 6x5 guess grid UI.
  - [ ] On-screen keyboard UI and input handling.
  - [ ] Header: Level, Score (TBD if part of MVP game screen or just profile), Coins, Hint & Skip buttons.
  - [ ] Create Coins component.
  - [ ] Create Level icon component.
  - [ ] Create Questions component for the riddle.
  - [ ] Create Grid component for guesses.
  - [ ] Create Controls component (Hint, Submit, Next buttons).
- **Victory/Loss Screens:**
  - [ ] Display attempts, score (if applicable), coins earned.
  - [ ] Shareable emoji summary.
  - [ ] Next/Retry/Home buttons.

### Backend & Authentication

- **Firebase Setup:**
  - [ ] Firebase Project Created & Configured.
  - [ ] Firestore: Define and implement security rules.
  - [ ] Firebase Storage: Define and implement security rules for avatars.
- **Authentication:**
  - [ ] Integrate Auth Screens with Navigation (e.g., React Navigation).
  - [ ] Implement Firebase Auth: Email/Password (sign-up, login) logic in screens.
  - [ ] Implement Firebase Auth: Google Sign-In logic.
  - [ ] Implement Firebase Auth: Microsoft Sign-In logic (Note: Project brief mentions Google and Email/Password. Microsoft is a new addition from the screenshot, confirm if it's in scope for MVP).
  - [ ] Implement Firebase Auth: Anonymous login (optional, confirm necessity for MVP).
  - [ ] Implement Firebase Auth: Password reset logic in `ForgotPasswordScreen.tsx`.
  - [ ] Implement Firebase Auth: Facebook Sign-In logic.
- **Riddle Management:**
  - [ ] Google Sheet: Initial 100+ riddle levels prepared.
  - [ ] Google Apps Script: Sync riddles from Sheets to Firestore (initial manual sync).
  - [ ] Firebase Cloud Function: Generate new 5-letter riddles (design and implement v1).
    - [ ] Update Firestore with new riddles.
    - [ ] Update Google Sheets with new riddles.

### In-App Purchases & Coin System

- **Coin System:**
  - [ ] Firestore: User coin balance tracking.
  - [ ] Prominent display of coin balance (header, profile, store).
  - [ ] Hint functionality (reveal a letter for 20 coins).
- **In-App Purchases (`react-native-iap`):**
  - [ ] Setup IAP library.
  - [ ] Define coin packs (100/$0.99, 500/$4.99, 1000/$9.99).
  - [ ] Implement purchase flow.
  - [ ] Server-side validation of purchases (Firebase Cloud Function).
  - [ ] "Restore Purchases" functionality.
- **Store Screen UI:**
  - [ ] List coin packs.
  - [ ] "Buy" buttons.

### Profile & Settings

- **Profile Overlay:**
  - [ ] UI: Avatar, username, XP bar.
  - [ ] UI: Daily puzzles completed stat.
  - [ ] UI: Stats grid (Best streak, Total words guessed, Win rate %, Average guesses).
  - [ ] UI: Treasure chest graphic + total coins.
  - [ ] Data fetching from Firestore.
- **Full Profile Page:**
  - [ ] UI: All overlay stats + total score, highest level, games played.
  - [ ] "Update Avatar":
    - [ ] Choose from 10-15 preloaded avatars.
    - [ ] Upload custom avatar (`react-native-image-picker`, ≤5 MB, PNG/JPEG).
    - [ ] Store avatar URL in Firestore.
    - [ ] Circular display (100x100 px).
- **Settings Overlay:**
  - [ ] UI: Toggles for Sound & Haptic feedback.
  - [ ] UI: "Help & Support?" link.
  - [ ] UI: "Logout" and "Reset Stats" buttons.
  - [ ] Functionality for toggles (persisting choices).
  - [ ] Logout functionality.
  - [ ] Reset Stats functionality (with confirmation).

### UI & UX General

- **Bottom Navigation (Home, Play, Profile icons).**
- [ ] Create Bottom Navigation component.
  - [ ] Implement Settings tab component.
  - [ ] Implement Level Selector tab component.
  - [ ] Implement Profile tab component.
- [ ] Overall app styling (clean cards, bold headings, rounded toggles) per screenshot hints.
- [ ] Basic animations with Reanimated & Gesture Handler.
- [ ] Sound effects with `expo-av`.
- [ ] Haptic feedback with `react-native-haptic-feedback`.

### Quality & Technical

- **Accessibility:**
  - [ ] Basic VoiceOver/TalkBack labels for key elements.
  - [ ] Initial considerations for color-blind patterns.
- **Testing:**
  - [ ] Jest: Initial unit tests for critical utility functions/game logic.
  - [ ] Detox: Setup and basic E2E test for app launch/navigation.
- **Performance:** Initial checks for input latency and cold start.
- [ ] Documentation: Code comments for complex logic, README updates.
- [ ] Secure, modular code structure.
- [ ] Deployment instructions (initial draft).

## 3. Current Project Status

- **Phase:** Initial UI Development for Authentication and foundational component creation.
- **Overall Progress:** ~10% (Auth screen UIs, NativeWind setup).
- **Next Milestone:** Integrate authentication screens with navigation, implement Firebase email/password authentication.

## 4. Known Issues & Blockers

- Placeholder icons and navigation logic in auth screens need replacement.
- Microsoft Sign-In was present in the UI mockups but not explicitly in the `projectbrief.md` authentication methods. Scope for MVP needs clarification if it's a hard requirement.

## 5. Evolution of Project Decisions & Learnings Log

- **{{YYYY-MM-DD}}:** Initial Memory Bank created. Project scope and core technologies documented.
  - _Decision:_ Proceed with React Context for initial global state management due to simplicity for MVP; re-evaluate for Zustand if complexity increases.
  - _Decision:_ AsyncStorage for initial client-side caching; re-evaluate for MMKV if performance issues arise.
- **2024-07-27:** Created basic UI for Landing, Login, and Sign Up screens based on provided screenshots.
  - Set up NativeWind, including `babel.config.js`, `tailwind.config.js`, and TypeScript typings.
  - Identified custom colors `primary-orange` (#FDBA74) and `cream-light` (#FAF3E0) from screenshots and added to Tailwind config.
  - _Note:_ Used direct `className` prop for NativeWind styling (v4 approach) instead of `styled` HOC after encountering linter issues.
  - _Observation:_ Screenshots include "Continue with Microsoft" which was not in the original brief. This needs to be clarified for MVP scope.
- **2024-07-27:** Created `ReusableTextInput` component and integrated it into `LoginScreen.tsx` and `SignUpScreen.tsx` to promote modularity and reusability in UI elements.
- **2024-07-27:** Added the "Confirm Password" field to the `SignUpScreen.tsx` and updated `src/constants/AppStrings.ts` to include the necessary strings (`CONFIRM_PASSWORD_LABEL` and `CONFIRM_PASSWORD_PLACEHOLDER`) to match the new field.
- **2024-07-28:** Confirmed use of `npm` for package management.
- **2024-07-28:** Attempted to switch to pnpm but encountered a persistent "Invalid package.json in package.json" error specifically within the project directory, preventing dependency installation. The cause of this error is currently unknown and requires further investigation outside the scope of available tools.
- **2024-07-28:** Successfully transitioned to using pnpm for package management.

_(This section will be updated with dates and summaries of key decisions, changes in direction, or significant learnings as the project progresses.)_
