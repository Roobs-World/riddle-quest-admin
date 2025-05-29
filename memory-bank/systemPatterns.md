# System Patterns

## 1. Architecture Overview

- **Client-Server Architecture**:
  - **Client**: React Native mobile application (iOS and Android).
  - **Server**: Firebase services (Firebase Authentication, Firestore, Firebase Cloud Functions, Firebase Storage).

## 2. Key Technical Decisions

- Use Firebase as the comprehensive backend-as-a-service (BaaS) platform.
- Implement server-side logic, including game validation and riddle generation, using Firebase Cloud Functions written in TypeScript.
- Store user data, game state, and riddle levels directly in Firestore.
- **MIGRATED**: Riddles are now stored directly in Firestore instead of using Google Sheets as the primary source. This eliminates the need for Google Sheets API integration and service account authentication.
- Employ Firebase Authentication for user management.
- Utilize Firebase Storage for user-uploaded content (avatars).
- React Native for cross-platform mobile development.
- NativeWind for styling within React Native.
- Implemented automatic content generation trigger: when a user's remaining classic riddles drop to 10 or fewer during a correct guess submission, 25 new riddles are automatically generated and stored directly in Firestore via the `submitGuessLogic` Cloud Function.
- Firebase Functions configuration migrated from `functions.config()` to `process.env` environment variables for v2 compatibility.
- **Enhanced Data Validation**: Strict answer validation preventing all punctuation marks, ensuring only lowercase letters (a-z) with maximum 7-character length.
- **Quality-First Content Generation**: Enhanced OpenAI prompts and server-side validation ensuring consistent riddle format and quality.

## 3. Design Patterns

- **Serverless Functions**: For backend logic, leveraging Firebase Cloud Functions.
- **Direct Database Storage**: Riddles stored directly in Firestore as the single source of truth, eliminating sync complexity.
- **State Management (Client)**: React Context or Zustand (as per project brief).
- **Asynchronous Operations**: For API calls, IAP, and background tasks.
- **Event-Driven (Backend)**: Cloud Functions triggered by HTTP requests, database changes, or scheduled events.
- **Object Pooling (Client)**: Implemented for the `ShatteringTitle` animation to manage letter objects efficiently.
- **Firestore Update Patterns**: Using specific types like `PlayerTopLevelUpdate` to handle updates involving `admin.firestore.FieldValue` while maintaining type safety and adhering to linting rules.
- **Validation-First Architecture**: Comprehensive data validation at multiple layers (client-side, server-side, and AI generation) ensuring data quality and consistency.
- **Fail-Safe Content Generation**: Multiple validation checkpoints preventing invalid content from entering the system.

## 4. Component Relationships

- **React Native App (Client)**: Interacts with Firebase Auth for login, Firestore for data, Cloud Functions for game logic/validation, and Firebase Storage for avatars.
  - Includes UI components like `GameScreen` which incorporates advanced animations (e.g., `ShatteringTitle` using Matter.js and Reanimated) for enhanced user feedback.
- **Firebase Cloud Functions**: Access Firestore to read/write game data, user stats, and riddles. Generate new riddles using OpenAI API and store them directly in Firestore. May call external APIs (e.g., OpenAI for riddle generation).
- **Firestore**: Stores user profiles, game progress, riddle levels (as primary source), IAP transaction records.
- **Firebase Authentication**: Manages user identities and sessions.
- **Firebase Storage**: Stores user avatar images.

## 5. Critical Implementation Paths

- Secure and reliable user authentication flow.
- Robust Firebase Functions deployment and versioning strategy.
- Direct riddle storage and retrieval from Firestore without external dependencies.
- Server-side validation of all game actions and in-app purchases.
- Scalable riddle generation mechanism, integrated into the classic game progression flow and storing directly to Firestore.
- Ad integration and IAP validation logic.
- Automatic content update trigger based on user engagement, storing new riddles directly in Firestore.
- **Enhanced Content Quality Pipeline**: Multi-layer validation ensuring all generated content meets strict quality standards before storage.
- **Comprehensive Test Coverage**: 184 passing tests across all Firebase Functions ensuring reliability and data integrity.
