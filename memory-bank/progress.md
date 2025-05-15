# Progress: Riddle Wordle Clone

## Current Date: {{YYYY-MM-DD}} (Update this with each significant progress entry)

## 1. What Works / Completed Features

- **Project Initialization & Planning:**
  - Memory Bank documents created (`projectbrief.md`, `productContext.md`, `techContext.md`, `systemPatterns.md`, `activeContext.md`, `progress.md`).
  - Initial project requirements and scope defined.
  - High-level architecture and technology stack choices outlined.

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
  - [ ] Firebase Auth: Email/Password (sign-up, login, password reset).
  - [ ] Firebase Auth: Google Sign-In.
  - [ ] Firebase Auth: Anonymous login (optional, confirm necessity for MVP).
  - [ ] Auth state management in-app.
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

- [ ] Bottom Navigation (Home, Play, Profile icons).
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

- **Phase:** Project Initiation & Planning.
- **Overall Progress:** ~5% (Memory Bank setup).
- **Next Milestone:** Basic environment setup, Firebase project creation, and start of Authentication module.

## 4. Known Issues & Blockers

- None at this initial stage.

## 5. Evolution of Project Decisions & Learnings Log

- **{{YYYY-MM-DD}}:** Initial Memory Bank created. Project scope and core technologies documented.
  - _Decision:_ Proceed with React Context for initial global state management due to simplicity for MVP; re-evaluate for Zustand if complexity increases.
  - _Decision:_ AsyncStorage for initial client-side caching; re-evaluate for MMKV if performance issues arise.

_(This section will be updated with dates and summaries of key decisions, changes in direction, or significant learnings as the project progresses.)_
