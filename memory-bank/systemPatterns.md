# System Patterns

## 1. Architecture Overview

- **Client-Server Architecture**:
  - **Client**: React Native mobile application (iOS and Android).
  - **Server**: Firebase services (Firebase Authentication, Firestore, Firebase Cloud Functions, Firebase Storage).

## 2. Key Technical Decisions

- Use Firebase as the comprehensive backend-as-a-service (BaaS) platform.
- Implement server-side logic, including game validation and riddle generation, using Firebase Cloud Functions written in TypeScript.
- Store user data, game state, and riddle levels in Firestore.
- Use Google Sheets as the primary source for riddle content, synced to Firestore.
- Employ Firebase Authentication for user management.
- Utilize Firebase Storage for user-uploaded content (avatars).
- React Native for cross-platform mobile development.
- NativeWind for styling within React Native.

## 3. Design Patterns

- **Serverless Functions**: For backend logic, leveraging Firebase Cloud Functions.
- **Data Synchronization**: Between Google Sheets (master riddle list) and Firestore (client-facing data).
- **State Management (Client)**: React Context or Zustand (as per project brief).
- **Asynchronous Operations**: For API calls, IAP, and background tasks.
- **Event-Driven (Backend)**: Cloud Functions triggered by HTTP requests, database changes, or scheduled events.

## 4. Component Relationships

- **React Native App (Client)**: Interacts with Firebase Auth for login, Firestore for data, Cloud Functions for game logic/validation, and Firebase Storage for avatars.
- **Firebase Cloud Functions**: Access Firestore to read/write game data, user stats. Interact with Google Sheets API (via Apps Script or directly) for riddle synchronization. May call external APIs (e.g., OpenAI for riddle generation).
- **Firestore**: Stores user profiles, game progress, riddle levels, IAP transaction records.
- **Google Sheets**: Master source for riddle data, updated manually or by Cloud Functions.
- **Firebase Authentication**: Manages user identities and sessions.
- **Firebase Storage**: Stores user avatar images.

## 5. Critical Implementation Paths

- Secure and reliable user authentication flow.
- Robust Firebase Functions deployment and versioning strategy.
- Efficient data synchronization between Google Sheets and Firestore.
- Server-side validation of all game actions and in-app purchases.
- Scalable riddle generation mechanism.
- Ad integration and IAP validation logic.
