# System Patterns

This document outlines the system architecture, key technical decisions, design patterns, and component relationships within the Riddle Quest project.

## System Architecture:

Client-Server architecture: React Native mobile app communicates with Firebase Functions (server-authoritative game logic) and Firestore (primary data store).

```
React Native App (iOS/Android)
│
├── Screens (LandingScreen, GameScreen, Auth screens)
├── Components (modals, game UI, buttons)
├── Hooks (useGameLogic, useModal, useSettings)
├── Contexts (AuthContext)
├── Services
│   ├── FirestoreService — CRUD operations on Firestore
│   ├── RiddleService — calls Firebase Functions for game actions
│   ├── RiddleDataService — riddle fetching and caching
│   ├── RiddleInitializationService — level bootstrapping
│   ├── UserDataService — user profile management
│   ├── AuthService — authentication flows
│   ├── IapService — in-app purchases
│   ├── SoundManager — audio playback (expo-audio)
│   ├── GameStateManager — local game state coordination
│   └── SocialSharingService — share results
└── Navigation (React Navigation stack)

Firebase Backend
├── Cloud Functions (submitGuess, getHint, spendCoins, validatePurchase, riddleGeneration, dailyScheduler)
├── Firestore (users, riddles, dailyChallenges)
├── Auth (email/password, Google, Facebook)
└── Storage (user avatars)
```

## Key Technical Decisions:

- **React Native 0.84.1**: Latest stable with New Architecture mandatory
- **React 19.2.4**: Concurrent features and improved DX
- **Firebase v23**: Modular API (`getFirestore()`, `getAuth()`, etc.) for tree-shaking
- **Jest 30.2.0**: Latest testing framework with `preset: "react-native"`
- **Expo SDK 55**: New Architecture mandatory; expo-audio for sound
- **Zod 4.x**: Schema validation for Firestore documents and API inputs
- **Server-authoritative**: All guess validation, coin transactions, and hint reveals happen server-side

## Design Patterns in Use:

- **Service Layer**: All data access isolated in service classes (`FirestoreService`, `RiddleService`, etc.)
- **Context Providers**: `AuthContext` for global auth state; `ModalProvider` for modal management
- **Server-Authoritative Game Logic**: `submitGuess`, `getHint`, `spendCoins` are Firebase `onCall` functions — clients never compute game outcomes
- **Atomic Transactions**: Coin operations use Firestore transactions to prevent race conditions
- **Centralized Modal Registry**: `ModalRegistry.tsx` maps modal names to components; `ModalProvider` controls visibility
- **Logger Abstraction**: `src/utils/logger.ts` gates verbose logging behind `__DEV__` to prevent JSI crashes in production
- **Zod Schema Validation**: Firestore documents validated on read/write via shared Zod schemas
- **Riddle Session Cache**: `FirestoreService` maintains an in-memory cache (max 50 entries) for daily/classic/tutorial riddle fetches to avoid repeated Firestore reads in the same session; `clearRiddleCache()` exported for tests
- **Backend Game Constants**: `firebase-functions/src/constants.ts` holds HINT*COST_COINS and SKIP_COST*\*; must stay in sync with client `src/constants/game.ts`. gameLogic (getHint, skipRiddle) uses these to avoid magic numbers and drift.

## Component Relationships:

- **GameScreen** orchestrates gameplay: renders `Header`, `RiddleText`, `GuessGrid`, `Keyboard`, `Controls`, `BottomNavigationBar`
- **useGameLogic** hook manages game state and calls `RiddleService` for server interactions
- **BottomNavigationBar** provides access to profile, hints, and settings
- **ModalProvider** wraps the app and manages modal visibility via `useModal` hook
- **AuthContext** wraps the navigation stack and gates authenticated routes

## Critical Implementation Paths:

1. **Guess Submission**: `Keyboard` → `useGameLogic.submitGuess()` → `RiddleService` → Firebase `submitGuess` function → returns feedback + game state
2. **Authentication**: `AuthService` → Firebase Auth → `AuthContext` state update → navigation guard
3. **IAP Flow**: `IapService` → React Native IAP → Firebase `validatePurchase` function → coin credit
4. **Riddle Generation**: `riddleGeneration` Firebase function → OpenAI API → Zod validation → Firestore write
5. **Daily Challenge**: `dailyScheduler` cron → generates daily riddle → stores in Firestore
6. **Achievements**: After `submitGuess` / `getHint` / `validatePurchase` (no-ads), `evaluateAchievements(userId, context)` runs; newly unlocked IDs are appended to user `unlockedAchievements`; client shows list in AchievementsModal (entry from profile).

## Data Models

### User Document

```typescript
interface UserData {
  userId: string;
  username: string;
  email: string;
  coins: number;
  progress: {
    classicIndex: number;
    completedDailyChallenges: string[];
  };
  statistics: {
    gamesPlayed: number;
    gamesWon: number;
    totalScore: number;
    totalHintsUsed: number;
    // ... other stats (winRate, currentStreak, etc.)
  };
  unlockedAchievements?: {achievementId: string; unlockedAt: number}[];
}
```

### Riddle Document

```typescript
interface Riddle {
  riddleId: string;
  text: string;
  answer: string;
  hints: string[];
  difficulty: number;
  type: "daily" | "classic" | "tutorial";
}
```

## Security Patterns

- Server-side validation for all game actions
- Atomic Firestore transactions for coin operations
- User authentication required for all game functions
- Input validation using Zod schemas
- Rate limiting on expensive operations

## Logging

- **Logger utility** (`src/utils/logger.ts`): Use instead of `console.log`/`warn`/`error` in production code
- **Levels**: `logger.debug`, `logger.info`, `logger.warn` (dev only); `logger.error` (always)
- **Rationale**: Prevents JSI crashes from excessive logging; production builds suppress verbose output

## Error Handling

- Graceful degradation when services are unavailable
- User-friendly error messages
- Comprehensive logging for debugging
- Fallback mechanisms for critical functionality

## State Management

- React Context for global app state
- Local component state for UI interactions
- AsyncStorage for user preferences
- Firestore as single source of truth for game data

### Testing

- **Pre-commit enforcement**: Husky runs `pnpm run test:precommit` before every commit (lint + RN tests + Firebase Functions tests). Commit blocked on failure.
- **Unified Test Command**: `pnpm run test`
  - Single command runs all tests
  - Automatic Firebase emulator management
  - **Firestore initialization with test data**
  - Runs Firebase Functions tests first
  - Then runs React Native tests
  - Graceful failure handling
  - Custom script at `scripts/test-all.js`
- **Test Data**: Automatic population of test riddles and users
- **Firebase Functions**: 386 tests at 61.65% coverage (11 files at 100%)
- **React Native**: Component, hook, and service tests via @testing-library/react-native
- **Total Test Coverage**: 2,497 tests across Firebase Functions (386) and React Native (2,111), 0 failures

### Testing Priorities (March 2026)

| File                    | Current | Target  | Notes                                   |
| ----------------------- | ------- | ------- | --------------------------------------- |
| riddleGeneration.ts     | 53.59%  | 70%+    | Complex Firebase mocking — roadmap item |
| submitGuessLogic.ts     | 94.65%  | ~95%    | Remaining lines are dead code           |
| iapConfig.ts            | 97.82%  | ~98%    | Lines 185-186 structurally unreachable  |
| iapPlatformValidator.ts | 97.72%  | ~98%    | Line 141 is dead code                   |
| firestoreService.ts     | 100%    | ✅ Done | Partial progress merge test added       |
| dailyChallenge.ts       | 100%    | ✅ Done | All functions fully covered             |

### Files at 100% Line Coverage (11 files)

profanityFilter.ts, firestoreSchemas.ts, openaiService.ts, profile.ts, iapReceiptService.ts, dailyScheduler.ts, adCallbacks.ts, iapValidation.ts, dailyChallenge.ts, index.ts, firestoreService.ts

## Code Documentation Standards

- **TSDoc for exported APIs**
  - All exported functions, hooks, React components, classes, and context values in `src/` and `firebase-functions/src/` SHOULD have a `/** ... */` TSDoc block.
  - Each block MUST include:
    - A one-line summary of the symbol’s purpose.
    - Optional additional details for behavior, invariants, and important edge cases.
    - `@param` and `@returns` tags for functions and hooks where the signature is not completely obvious from the name alone.
  - For React components and screens, the primary props interface SHOULD be documented with `@property` tags for all non-trivial props.
  - For hooks, the TSDoc MUST describe:
    - Input arguments (if any) and how they are expected to be used.
    - The structure of the returned object or tuple.
    - Any side effects (network calls, navigation, storage access) and when they occur.

- **`@fileoverview` for complex modules**
  - High-complexity orchestrators (e.g., navigation, modal provider, core game logic hooks, complex animation/background components) SHOULD include a `@fileoverview` block at the top of the file that:
    - Describes the module’s role in the overall architecture.
    - Highlights key behaviors or flows.
    - Notes any important performance or integration considerations.
  - Existing examples such as `src/components/background/StarryBackground.tsx` and `src/components/modals/ModalProvider.tsx` SHOULD be used as reference style guides.

- **Markdown for subsystem overviews**
  - When a folder contains multiple modules that work together (e.g., `src/hooks/`, `src/contexts/`, `src/services/`), a short `README.md` MAY be added to:
    - Describe the purpose of the folder.
    - Explain how modules are intended to be used together.
    - Capture any conventions (e.g., hooks that must only be used under certain providers).

- **Signal over noise**
  - Comments MUST focus on intent, behavior, invariants, and external contracts rather than restating obvious implementation details.
  - Documentation-only changes MUST NOT alter runtime behavior and do not require new tests, but any behavioral code changes MUST follow the usual TDD workflow.
