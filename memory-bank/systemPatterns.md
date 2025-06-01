# System Patterns

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
- **Firebase Functions**: 218 tests - all passing
- **React Native**: 172 tests - running (46 failing due to test logic, not infrastructure)
- **Total Test Coverage**: 390 tests, 344 passing
- **Infrastructure**: Both test suites working with proper transformations
