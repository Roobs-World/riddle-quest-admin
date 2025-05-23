# Project Brief

## 1. Project Name

Qwordly (inferred from workspace path)

## 2. Project Goals

- To be defined.

## 3. Target Audience

- To be defined.

## 4. Scope

### In Scope:

- Firebase Functions deployment.

### Out of Scope:

- To be defined.

## 5. Success Metrics

- Successful deployment of Firebase Functions.
- To be defined.

## Project Overview

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

- **Authentication:** Firebase Auth (Google, Facebook, email/password, password reset). Anonymous login will not be implemented.
- **Database:** Firestore (user stats, progress, coin balances, avatar URLs, riddle levels - **primary source: Google Sheets, Firestore is a synced mirror for client access**)
- **Storage:** Firebase Storage (user-uploaded avatars)
- **Level Management:**
  - Initial 100+ riddle levels synced from Google Sheets (via Apps Script). Source: [https://docs.google.com/spreadsheets.com/spreadsheets/d/1TIbc2oef3xZ_8s30mX3eDn6jbe6SKBnqmjXLa1kmzXA/edit?gid=0#gid=0](https://docs.google.com/spreadsheets.com/spreadsheets/d/1TIbc2oef3xZ_8s30mX3eDn6jbe6SKBnqmjXLa1kmzXA/edit?gid=0#gid=0) (Tabs: Daily, Tutorial, Classic).
  - Firebase Cloud Function to generate new riddles continuously for Classic Mode (current implementation allows for variable answer lengths, not strictly 5-letter), adding them directly to Google Sheets. This function is triggered by the client when a user reaches the end of currently available Classic levels, ensuring an unlimited supply of puzzles. The client will then fetch the new levels from Firestore, which is synced from the Sheets.

### 2.3. Game Modes

- **Challenge Mode:**
  - One daily riddle (any letter answer length).
    5 guesses with color feedback (green/yellow/red). **Guess validation and feedback are handled server-side.**
  - Coin rewards based on guesses (20 for 1-guess, 15 for 2, etc.).
  - Locks until the next UTC day.
- **Classic Mode:**
  - Sequential levels from Sheets/Firestore.
  - Solve to unlock the next level.
  - Option to spend 50 coins to skip a level.
    Same 5-guess grid and feedback. **Guess validation and feedback are handled server-side.**

### 2.4. In-App Purchases & Coin System

- **IAP:** `

### 2.5. Advertising

- **Ad Network:** AppLovin MAX
- **Types:** Rewarded Ads (for coins/hints), Interstitial Ads (shown between levels if the user has not purchased the app).
- **Environment Variables:** `APPLOVIN_SDK_KEY`, `APPLOVIN_INTERSTITIAL_AD_UNIT_ID`, `APPLOVIN_REWARDED_AD_UNIT_ID`.

### 2.6. User Profiles & Stats

// ... existing code ...

### 2.8. Quality & Performance

- **Code:** Secure, documented, modular. **Core game logic, including guess validation and win/loss conditions, is implemented server-side for security and authority.**
- **Testing:** Comprehensive unit and integration tests for both client-side (React Native) and server-side (Firebase Functions) code to ensure reliability and maintainability.
