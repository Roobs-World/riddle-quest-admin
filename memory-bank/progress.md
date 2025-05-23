# Project Progress

## 1. What Works

### Firebase Functions

- **Test Infrastructure**: Jest testing framework properly configured with TypeScript support
- **Unit Test Coverage**: Comprehensive unit tests added/reviewed for:
  - `firestoreService.ts`
  - `dailyChallenge.ts`
  - `gameLogic.ts`
  - `generateRiddles.ts` (with added error handling tests)
  - `iapValidation.ts` (unit test file created with initial tests)
  - `adCallbacks.ts`
  - `openaiService.ts`
- **Core Services**:
  - `firestoreService.ts` - User data management functions (getUser, updateUserCoins, updateUserStats, updateUserProfile, getRiddle)
  - `gameLogic.ts` - Game mechanics (getHint, spendCoins, skipRiddle)
  - `openaiService.ts` - AI riddle generation service
  - `riddleGeneration.ts` - Riddle generation orchestration
  - `iapConfig.ts` - In-app purchase configuration
  - `submitGuessLogic.ts` - Includes server-side guess validation, feedback, user stats/coin updates, and Classic mode level unlocking upon solve.
  - `profile.ts` - Includes function to reset stats and update avatar URL.
  - `dailyScheduler.ts` - Scheduled function to set the daily challenge.
- **Linting Progress**: Reduced linting errors from 136 to 70 by:
  - Fixed all spacing/formatting issues in `firestoreService.test.ts`
  - Replaced `any` types with proper TypeScript types in `firestoreService.ts`, `gameLogic.ts`, `iapConfig.ts`, and `openaiService.ts`
  - Removed unused parameters and functions in `openaiService.ts` and `riddleGeneration.ts`
  - Fixed import paths to include `.js` extensions as required by module resolution
  - Fixed quote consistency (single to double quotes) in test files
  - Removed unused imports and variables
  - Added missing `getRiddle` function to `firestoreService.ts`
  - Fixed type casting issues using `unknown` first approach
  - Fixed complex mock type issues in `submitGuessLogic.test.ts`
  - Cleaned up `riddleGeneration.test.ts` and `index.test.ts` with proper types
  - Replaced `require()` with dynamic `import()` statements
  - Resolved `@jest/globals` type resolution issue after switching to pnpm and removing `typeRoots`.

### React Native App

- **Authentication**: Firebase Auth integration with Google, Facebook, email/password
- **Navigation**: React Navigation setup with proper TypeScript types
- **State Management**: Context-based state management for user data
- **UI Components**: NativeWind styling system integrated
- **Game Screens**: Basic game interface components

## 2. What's Left to Build

### Remaining Linting Issues (Still need to verify the exact number after recent changes)

- Complex mock type issues in some test files (`generateRiddles.test.ts`, `iapValidation.test.ts`)
- Potential lingering formatting/linting issues.

### Firebase Functions

- **Missing Functions**:
  - Complete IAP validation logic (core logic is in `iapValidation.ts`, but related functions might be missing)
  - Daily challenge scheduling
- **Needs Completion/Verification:**
  - Complete IAP validation logic (core logic is in `iapValidation.ts`, but related functions might be missing) - Primarily requires more comprehensive testing.
  - Full server-side implementation and testing of Advertising (rewarded ad callbacks, coin granting) - Primarily requires more comprehensive testing.

### React Native App

- **Game Logic**: Complete Wordle-style game implementation
- **Daily Challenges**: Challenge mode with daily puzzles
- **Classic Mode**: Progressive level system
- **In-App Purchases**: Coin system and no-ads purchase
- **User Profiles**: Avatar upload, stats display
- **Offline Support**: Local caching with AsyncStorage/MMKV

### Integration

- **API Integration**: Connect React Native app to Firebase Functions
- **Real-time Updates**: Firestore listeners for live data
- **Error Handling**: Comprehensive error handling and user feedback
- **Testing**: Implement comprehensive integration tests and end-to-end tests.

## 3. Current Status

**Phase**: Backend Development - Test Coverage Expansion and Missing Functionality Implementation
**Next Priority**: Implement integration and end-to-end tests. Address remaining linting/typing issues in test files.
**Blockers**: Complex type compatibility issues in some test mocks.

## 4. Known Issues

- Complex mock type issues in some test files (`generateRiddles.test.ts`, `iapValidation.test.ts`) causing linter errors.
- Potential lingering formatting Linter errors.
- IAP Warning: "Missing Apple Shared Secret or Google Service Account environment variables for IAP validation" noted in previous deployment output (separate from current test fixes).

## 5. Evolution of Project Decisions

- Adopted strict TypeScript linting rules requiring explicit file extensions
- Moved from `any` types to proper TypeScript typing for better type safety
- Standardized on double quotes for string literals
- Implemented proper error handling with typed catch blocks
- Standardized Jest imports and mock usage.
- Improved test type safety by using union types for mock data instead of `any`.
- Enhanced test coverage for Firebase functions with edge cases and error handling.
- Added deterministic date testing using spies for better test reliability.
- Switched to pnpm for package management, which resolved `@jest/globals` type resolution issues.

## Recent Achievements

- ✅ Fixed all formatting issues in test files
- ✅ Improved type safety by removing `any` types from core service files
- ✅ Cleaned up unused imports and functions
- ✅ Maintained existing functionality while improving code quality
- ✅ Added unit tests for `generateRiddles.ts` error handling.
- ✅ Created unit test file for `iapValidation.ts` with initial tests.
- ✅ Resolved `@jest/globals` type resolution issue.
- ✅ Implemented Classic mode level unlocking upon solving a riddle.
- ✅ Added function to update user avatar URL.
- ✅ Addressed linter errors related to Firebase FieldValue type compatibility and scheduled function context typing (using `any` temporarily).
- ✅ Implemented daily challenge scheduling (basic random selection and storage).
