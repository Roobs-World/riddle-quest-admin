# System Patterns

This document outlines the system architecture, key technical decisions, design patterns, and component relationships within the Qwordly project.

## System Architecture:

[Describe the overall architecture, e.g., Client-Server (React Native app + Firebase Functions/Firestore), key components and how they interact.]

## Key Technical Decisions:

- **React Native 0.83.1**: Latest stable version for modern mobile development with improved performance and ES modules
- **React 19.0.0**: Latest major version for enhanced concurrent features and improved developer experience
- **Firebase v23**: Latest Firebase SDK with modular API for better tree-shaking and performance
- **Jest 30.2.0**: Latest testing framework with improved performance and compatibility
- **Expo SDK 54**: Latest Expo toolchain for development and building

### Recent Major Updates (January 2025):

- **Package Updates**: All dependencies updated to latest versions for security and performance
- **Jest Configuration**: Overhauled for React Native 0.83.1 ES module compatibility
- **Firebase Migration**: Complete migration from v22 to v23 modular API
- **Babel Configuration**: Updated with conditional presets for test environments

## Design Patterns in Use:

- [Identify and describe prominent design patterns used in the codebase, e.g., Repository pattern for data access, Observer pattern.]

## Component Relationships:

[Describe how major components interact with each other, possibly using a simple diagram or text description.]

## Critical Implementation Paths:

[Outline the most important or complex parts of the system that require careful implementation and testing, e.g., User authentication flow, Game state management, In-app purchase handling.]

## Architecture Overview

```
Client (React Native)
├── Authentication Layer (Firebase Auth)
├── State Management (React Context)
├── UI Components (React Native + NativeWind)
├── Services Layer
│   ├── FirestoreService (Database operations)
│   ├── SoundManager (Audio management)
│   └── RiddleService (Game logic via Firebase Functions)
└── Navigation (React Navigation)
```

## Core Services

### FirestoreService

- User data management
- Riddle storage and retrieval
- Progress tracking
- Statistics management

### RiddleService

- Server-side game logic via Firebase Functions
- Guess validation and feedback
- Hint system
- Coin management

## Firebase Functions Pattern

All game logic is server-authoritative:

1. **Submit Guess Function**

```typescript
export const submitGuess = onCall(async (request) => {
  // Validate user authentication
  // Process guess against riddle
  // Return feedback and game state
  // Award coins based on performance
});
```

2. **Get Hint Function**

```typescript
export const getHint = onCall(async (request) => {
  // Validate user has sufficient coins
  // Reveal hint for current riddle
  // Deduct coin cost
  // Track hint usage
});
```

3. **Spend Coins Function**

```typescript
export const spendCoins = onCall(async (request) => {
  // Validate coin balance
  // Execute transaction atomically
  // Update user document
  // Return new balance
});
```

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
    // ... other stats
  };
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

- **Unified Test Command**: `pnpm run test`
  - Single command runs all tests
  - Automatic Firebase emulator management
  - **Firestore initialization with test data**
  - Runs Firebase Functions tests first
  - Then runs React Native tests
  - Graceful failure handling
  - Custom script at `scripts/test-all.js`
- **Test Data**: Automatic population of test riddles and users
- **Firebase Functions**: 275 tests at 62.27% coverage
- **React Native**: Component, hook, and service tests (Jest configuration updated for RN 0.83.1)
- **Total Test Coverage**: 390+ tests across Firebase Functions and React Native
- **Known Issues**: Firebase mock updates needed for v23 API compatibility
- **Infrastructure**: Jest configuration updated for React Native 0.83.1 ES modules

### Testing Priorities (January 2025)

| File | Current | Target | Notes |
|------|---------|--------|-------|
| riddleGeneration.ts | 49.72% | 70%+ | Complex Firebase mocking |
| iapValidation.ts | 98.33% | 100% | 1 line remaining |
| firestoreService.ts | 97.01% | 100% | 2 lines remaining |
| iapPlatformValidator.ts | 97.72% | 100% | 1 line remaining |
| dailyChallenge.ts | 96.42% | 100% | 2 lines remaining |
