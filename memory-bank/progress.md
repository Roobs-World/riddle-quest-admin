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
  - [x] Riddle text display (Integrated `RiddleText.tsx`).
  - [x] 6x5 guess grid UI (Integrated `GuessGrid.tsx` and updated to display current guess and submitted guesses with feedback).
  - [x] On-screen keyboard UI and input handling (Integrated `Keyboard.tsx`, added `onKeyPress` prop, and implemented basic letter adding/deleting/enter handling).
  - [x] Header: Level, Score (TBD if part of MVP game screen or just profile), Coins, Hint & Skip buttons (Integrated `Header.tsx`).
  - [ ] Create Coins component (Needed for Header - UI in place, logic pending).
  - [ ] Create Level icon component (Needed for Header - UI in place, logic pending).
  - [x] Create Questions component for the riddle (Integrated `RiddleText.tsx`).
  - [x] Create Grid component for guesses (Integrated `GuessGrid.tsx`).
  - [x] Create Controls component (Hint, Submit, Next buttons - Needed for Header or separate controls area - UI in Header component, hint/skip logic partially implemented).
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
  - [ ] Integrate Auth Screens with Navigation (using a stack navigator for the auth flow).
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
    - [ ] **Implement Google Sheets Riddle Service:** Create a dedicated service to fetch riddles from the specified Google Sheet tabs (Daily, Tutorial, Classic) one at a time as needed by the game.

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

- **Bottom Overlays/Modals (for Home, Play, Profile).**
- [ ] Design and implement overlay/modal components for Home, Play, and Profile.
- [ ] Implement logic to trigger the correct overlay/modal from the bottom bar icons.
- **Bottom Navigation Bar:**
  - [x] Create a persistent bottom bar UI component with Home, Play, and Profile icons (Integrated `BottomNavigationBar.tsx`).
  - [ ] Implement logic to trigger the correct overlay/modal from the bottom bar icons.
  - [ ] Design and implement overlay/modal components for Home, Play, and Profile.
- [ ] Ensure overlays/modals provide quick access and do not fully transition away from the main game context.
- [ ] Overall app styling (clean cards, bold headings, rounded toggles) per screenshot hints.
- [ ] Basic animations with Reanimated & Gesture Handler.
- [ ] Sound effects with `expo-av`.
- [ ] Haptic feedback with `react-native-haptic-feedback`.
- [ ] Implement a first-time user instructions panel to guide new users.

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
- **Overall Progress:** ~20% (Auth screen UIs, NativeWind setup, GameScreen UI components integrated, initial game logic for input handling and display).
- **Next Milestone:** Implement core game logic (guess validation, feedback, win/loss conditions) and integrate with state management.

- **Phase:** Core Gameplay and UI Integration.
- **Overall Progress:** ~25% (Auth screen UIs, NativeWind setup, GameScreen UI components and overlays integrated, core game logic for input, feedback, win/loss checks, hints, and skips implemented, modal button logic for retry/home/next implemented).
- **Next Milestone:** Integrate actual riddle data and coin logic, and implement bottom navigation overlay/modal logic.

## 4. Known Issues & Blockers

- Placeholder icons and navigation logic in auth screens need replacement.
- Microsoft Sign-In was present in the UI mockups but not explicitly in the `projectbrief.md` authentication methods. Scope for MVP needs clarification if it's a hard requirement.
- TODO: Implement actual guess validation logic (check against `correctAnswer` and update feedback).
- TODO: Implement win/loss conditions and display appropriate screens/modals.
- TODO: Implement visual feedback for invalid guesses (e.g., shake animation for guess row).
- TODO: Replace placeholder colors in GuessGrid with defined Tailwind colors.
- TODO: Implement logic for Hint and Skip buttons in the Header.
- TODO: Implement logic to open overlays/modals from the Bottom Navigation Bar.
- TODO: Integrate actual riddle fetching logic from backend/data source.
- TODO: Implement actual coin earning logic on winning a level.
- TODO: Implement logic for the Bottom Navigation Bar buttons to open appropriate overlays/modals.

**Gameplay Visuals & Feedback:**

- [ ] Ensure Guess Grid cell colors reflect feedback:
  - Red: Incorrect character.
  - Orange: Correct character, wrong position (use `primary-orange`).
  - Green: Correct character, correct position.
- [ ] Implement visual feedback for invalid guesses (e.g., a subtle animation or message).

**Core Game Logic & Data:**

- [ ] Integrate actual riddle fetching logic from backend/data source.
- [ ] Implement actual coin earning logic on winning a level.

**Navigation & Overlays:**

- [ ] Implement logic for the Bottom Navigation Bar buttons to open appropriate overlays/modals.
- [ ] Implement logic for Hint and Skip buttons in the Header.

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
- **2024-07-29:** Implemented Firebase email/password sign-up, login, password reset, Google Sign-In, and logout functions in `src/services/AuthService.ts`. Encountered persistent linter error on `UserCredential` import and missing `@react-native-google-signin/google-signin` dependency.
- **2024-07-30:** Decided that the bottom navigation icons (Home, Play, Profile) should open overlays/modals instead of navigating to new screens to provide quick access to these features without leaving the main game context. This changes the approach from a traditional bottom tab navigator to a persistent bottom bar triggering modal views.
- **2024-07-31:** Integrated `Keyboard.tsx` component into `GameScreen.tsx` and added a basic `handleKeyPress` function placeholder. Updated `Keyboard.tsx` to accept and use the `onKeyPress` prop, resolving a linter error and enabling communication between the screen and the keyboard component.
- **2024-08-01:** Created and integrated `Header.tsx`, `RiddleText.tsx`, and `GuessGrid.tsx` components into `GameScreen.tsx`. Added state (`guesses` and `currentGuess`) to `GameScreen.tsx` to manage game progress. Updated `handleKeyPress` in `GameScreen.tsx` to handle adding/deleting letters and a basic ENTER key press. Updated `GuessGrid.tsx` to accept `currentGuess` and display both submitted and current guesses, including basic color styling based on placeholder feedback.
- **2024-08-01:** Created and integrated `BottomNavigationBar.tsx` component into `GameScreen.tsx` with placeholder buttons for Home, Play, and Profile, and added placeholder press handlers.
- **2024-08-01:** Updated `handleKeyPress` in `GameScreen.tsx` to include basic guess validation (length check) and placeholder feedback generation logic for the 'ENTER' key. Also added basic win/loss console logs based on placeholder logic. Updated `guesses` state structure to include feedback.
- **2024-08-01:** Updated `GuessGrid.tsx` to correctly handle the new `SubmittedGuess[]` state structure, display submitted guesses with their associated feedback colors, and continue to display the `currentGuess` in the active row.
- **2024-08-02:** Created and integrated `HintOverlay.tsx` and `SkipOverlay.tsx` components into `GameScreen.tsx`. Added state for their visibility and updated the `handleHintPress` and `handleSkipPress` functions to show these overlays.
- **2024-08-02:** Implemented basic logic within `handleShowHint` to deduct coins and update the `currentGuess` state with a revealed letter from the `correctAnswer`. Implemented basic logic within `handleConfirmSkip` to deduct coins, set game over, and show the loss modal.
- **2024-08-02:** Implemented logic for the `handleRetryPress` function in `GameScreen.tsx` to reset the game state.
- **2024-08-02:** Implemented logic for the `handleModalHomePress` function in `GameScreen.tsx` to reset the game state and hide the victory/loss modals.
- **2024-08-02:** Implemented logic for the `handleNextLevelPress` function in `GameScreen.tsx` to reset the game state and hide the victory modal, preparing for the next level.

_(This section will be updated with dates and summaries of key decisions, changes in direction, or significant learnings as the project progresses.)_
