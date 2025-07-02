# Project Brief

This document outlines the core requirements and goals for the project.

## Project Name:

Qwordly (inferred from workspace path)

## Project Description:

Build a riddle-based Wordle-clone mobile game using React Native, NativeWind, and TypeScript. The game will feature user authentication, a persistent backend for user data and game levels, multiple game modes, in-app purchases for a coin system, and customizable user profiles.

## Core Requirements:

- Firebase Functions deployment.
- Development of iOS (16+) and Android (10+) application.
- User authentication (Google, Facebook, email/password).
- Firestore database for user data and riddle levels (primary storage).
- Firebase Storage for user avatars.
- Server-side riddle generation and guess validation.
- Two primary game modes: Daily Challenge and Classic Mode.
- In-app purchase system for coins and ad removal.
- AppLovin MAX integration for rewarded and interstitial ads.
- User profiles with statistics and customizable avatars.
- Game win 'shattering title' animation.

## Goals:

- To build a fully functional riddle-based Wordle-clone mobile game, Qwordly.
- Implement all core features including user authentication, persistent backend, multiple game modes, in-app purchases, and customizable user profiles.
- Ensure successful deployment and operation of Firebase Functions for backend logic.
- Achieve comprehensive test coverage for both client and server-side code.
- Implement audio fading for background music and sound effects based on user progress or game state.

## Stakeholders:

- Mobile gamers who enjoy word puzzles and riddle-based challenges.
- Users looking for engaging daily and progressive puzzle experiences.

## Key Assumptions:

- The project will be developed using React Native, NativeWind, and TypeScript.
- The game will feature user authentication, a persistent backend for user data and game levels, multiple game modes, in-app purchases for a coin system, and customizable user profiles.
- The game will be deployed on iOS (16+) and Android (10+) platforms.

## Constraints:

- The project will not include anonymous login.
- The game will not include real-time multiplayer features beyond individual progression.
- The game will not include social features like friend lists or direct messaging.
- The project will not include a web-based version of the game.

## Definition of Done:

- The project will be successfully deployed and stable in operation.
- Positive user engagement metrics (e.g., daily active users, session length) will be achieved post-launch.
- High test coverage for critical game logic and backend services will be achieved.
- All features outlined in the core requirements will be successfully implemented.

## Project Overview

Build a riddle-based Wordle-clone mobile game using React Native, NativeWind, and TypeScript. The game will feature user authentication, a persistent backend for user data and game levels, multiple game modes, in-app purchases for a coin system, and customizable user profiles.

## 2. Core Requirements

### 2.1. Platform & Technology

- **Mobile Platform:** iOS (16+) and Android (10+)
- **Frontend:** React Native (0.75+), NativeWind, TypeScript
- **State Management:** React Context or Zustand
- **Caching:** AsyncStorage or MMKV
- **Animations:** Reanimated & Gesture Handler, Matter.js (for physics-based animations)
- **Sound:** expo-av
- **Haptics:** react-native-haptic-feedback

### 2.2. Backend & Authentication

- **Authentication:** Firebase Auth (Google, Facebook, email/password, password reset). Anonymous login will not be implemented.
- **Database:** Firestore (user stats, progress, coin balances, avatar URLs, riddle levels - **primary and only source**)
- **Storage:** Firebase Storage (user-uploaded avatars)
- **Level Management:**
  - Riddle levels stored directly in Firestore with automatic generation.
  - Firebase Cloud Function to generate new riddles continuously for Classic Mode (current implementation allows for variable answer lengths, not strictly 5-letter), storing them directly in Firestore. This function is triggered by the client when a user reaches the end of currently available Classic levels, ensuring an unlimited supply of puzzles.

### 2.3. Game Modes

- **Challenge Mode:**
  - One daily riddle (any letter answer length).
    5 guesses with color feedback (green/yellow/red). **Guess validation and feedback are handled server-side.**
  - Coin rewards based on guesses (20 for 1-guess, 15 for 2, etc.).
  - Locks until the next UTC day.
- **Classic Mode:**
  - Sequential levels from Sheets/Firestore.
  - Solve to unlock the next level.
    Same 5-guess grid and feedback. **Guess validation and feedback are handled server-side.**

### 2.4. In-App Purchases & Coin System

- **IAP:** (Details to be defined, e.g., specific coin pack amounts, pricing, no-ads purchase option details)
  - Purchase `react-native-iap` or equivalent for managing IAPs.
  - Server-side validation of purchases with Firebase Functions.
- **Coin System:**
  - Coins for hints (Classic Mode).
  - Earn coins via daily challenges and rewarded ads.

### 2.5. Advertising

- **Ad Network:** AppLovin MAX
- **Types:** Rewarded Ads (for coins/hints), Interstitial Ads (shown between levels if the user has not purchased the app).
- **Environment Variables:** `APPLOVIN_SDK_KEY`, `APPLOVIN_INTERSTITIAL_AD_UNIT_ID`, `APPLOVIN_REWARDED_AD_UNIT_ID`, `APPLE_SHARED_SECRET`, `GOOGLE_SERVICE_ACCOUNT` (JSON string for IAP), `OPENAI_API_KEY`, `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_CLIENT_TOKEN`.

### 2.6. User Profiles & Stats

- User accounts with persistent data (stats, progress, coins, avatar).
- Ability for users to upload and change their avatar (stored in Firebase Storage).
- Display of game statistics (e.g., win rate, current streak, games played).

### 2.8. Quality & Performance

- **Code:** Secure, documented, modular. **Core game logic, including guess validation and win/loss conditions, is implemented server-side for security and authority.**
- **Testing:** Comprehensive unit and integration tests for both client-side (React Native) and server-side (Firebase Functions) code to ensure reliability and maintainability. Integration tests connect directly to the live Firebase project, not the emulator.
