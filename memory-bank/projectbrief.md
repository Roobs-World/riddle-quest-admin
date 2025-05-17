# Project Brief: Riddle Wordle Clone

## 1. Project Overview

Build a riddle-based Wordle-clone mobile game using React Native, NativeWind, and TypeScript. The game will feature user authentication, a persistent backend for user data and game levels, multiple game modes, in-app purchases for a coin system, and customizable user profiles.

## 2. Core Requirements

### 2.1. Platform & Technology

- **Mobile Platform:** iOS (16+) and Android (10+)
- **Frontend:** React Native (0.75+), NativeWind, TypeScript
- **State Management:** React Context or Zustand
- **Caching:** AsyncStorage or MMKV
- **Animations:** Reanimated & Gesture Handler
- **Sound:** expo-av
- **Haptics:** react-native-haptic-feedback

### 2.2. Backend & Authentication

- **Authentication:** Firebase Auth (Google, Facebook, email/password, password reset, optional anonymous)
- **Database:** Firestore (user stats, progress, coin balances, avatar URLs, riddle levels)
- **Storage:** Firebase Storage (user-uploaded avatars)
- **Level Management:**
  - Initial 100+ riddle levels synced from Google Sheets (via Apps Script).
  - Firebase Cloud Function to generate new 5-letter riddles when levels run out (updating Firestore & Sheets).

### 2.3. Game Modes

- **Challenge Mode:**
  - One daily riddle (5-letter answer).
  - 6 guesses with color feedback (green/yellow/gray).
  - Coin rewards based on guesses (20 for 1-guess, 15 for 2, etc.).
  - Locks until the next UTC day.
- **Classic Mode:**
  - Sequential levels from Sheets/Firestore.
  - Solve to unlock the next level.
  - Option to spend 50 coins to skip a level.
  - Same 6-guess grid and feedback.

### 2.4. In-App Purchases & Coin System

- **IAP:** `react-native-iap` for coin purchases (100 coins/$0.99, 500/$4.99, 1000/$9.99).
- **Server-side Validation:** For IAP.
- **Coin Usage:** Skip levels (50 coins), buy hints (20 coins to reveal a letter).
- **Coin Balance Display:** Prominently in header, profile, and store.

### 2.5. User Profile

- **Profile Overlay (from bottom nav "profile"):**
  - Circular avatar, username, XP bar (e.g., "320 – 500").
  - Daily puzzles completed.
  - Stats grid: Best streak, Total words guessed, Win rate %, Average guesses.
  - Treasure chest graphic + total coins.
- **Full Profile Page (from home/settings):**
  - All overlay stats + total score, highest level, games played.
  - "Update Avatar": Choose from 10-15 preloads or upload (PNG/JPEG, ≤5 MB) via `react-native-image-picker`.
  - Avatar URL stored in Firestore, displayed as 100x100 px circular image.

### 2.6. Settings Overlay

- Accessible from bottom nav or gear icon.
- Toggles for Sound and Haptic feedback.
- "Help & Support?" link (FAQ or contact form).
- "Logout" and "Reset Stats" buttons (secondary section).

### 2.7. UI & UX

- Clean card-based design, bold headings, rounded toggles (mimic screenshot styling).
- Bottom navigation with home, play, profile icons. Tapping these icons will open corresponding overlays/modals.
- **Main Game Screen:** Riddle text, 6x5 guess grid, on-screen keyboard, header (Level, Score, Coins, Hint & Skip buttons).
- **Store Screen:** List coin packs with "Buy"/"Restore Purchases" buttons.
- **Victory/Loss Screens:** Attempts, score, coins earned, shareable emoji summary, Next/Retry/Home buttons.
- **Accessibility:** VoiceOver/TalkBack labels, color-blind patterns, adjustable text size.

### 2.8. Quality & Performance

- **Code:** Secure, documented, modular.
- **Testing:** Jest (unit tests), Detox (e2e tests).
- **Performance:** <100 ms input latency, <2 s cold start time.

## 3. Key Goals

- Deliver a fully functional MVP (Minimum Viable Product) within 2 weeks.
- Provide an engaging and intuitive user experience.
- Ensure a robust and scalable backend system for user data and dynamic riddle generation.
- Implement secure authentication and in-app purchase flows.
- Achieve high performance and accessibility standards.

## 4. Deliverables

- Secure and well-documented code repository.
- Google Sheet setup for initial riddle levels.
- Firebase Cloud Function for dynamic riddle generation.
- Functional Profile and Settings overlays as per design.
- Complete authentication and in-app purchase flows.
- Comprehensive test suites (unit and e2e).
- Deployment instructions.
