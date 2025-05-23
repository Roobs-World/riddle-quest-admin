# Project Progress

## 1. What Works

### Firebase Functions

- **Test Infrastructure**: Jest testing framework properly configured with TypeScript support
- **Core Services**:
  - `firestoreService.ts` - User data management functions (getUser, updateUserCoins, updateUserStats, updateUserProfile, getRiddle)
  - `gameLogic.ts` - Game mechanics (getHint, spendCoins, skipRiddle)
  - `openaiService.ts` - AI riddle generation service
  - `riddleGeneration.ts` - Riddle generation orchestration
  - `iapConfig.ts` - In-app purchase configuration
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

### React Native App

- **Authentication**: Firebase Auth integration with Google, Facebook, email/password
- **Navigation**: React Navigation setup with proper TypeScript types
- **State Management**: Context-based state management for user data
- **UI Components**: NativeWind styling system integrated
- **Game Screens**: Basic game interface components

## 2. What's Left to Build

### Remaining Linting Issues (70 errors)

- Complex mock type issues in remaining test files (profile.test.ts, generateRiddles.test.ts)
- Some test files with sophisticated mocking setups
- Mock function compatibility issues in edge cases

### Next Steps

1. Focus on simpler linting fixes first (quotes, unused variables, basic type issues)
2. Address complex mock typing issues in test files
3. Ensure all imports use proper `.js` extensions
4. Replace remaining `any` types with proper TypeScript types

### Firebase Functions

- **Missing Functions**:
  - Complete IAP validation logic
  - Daily challenge scheduling
  - User profile management endpoints

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
- **Testing**: End-to-end testing between app and backend

## 3. Current Status

**Phase**: Backend Development - Linting and Code Quality
**Next Priority**: Complete Firebase Functions linting fixes and implement missing core functions
**Blockers**: Complex type compatibility issues in game logic functions

## 4. Known Issues

- Critical Linter error: `Cannot find module '@jest/globals' or its corresponding type declarations.` in all Jest test files within `firebase-functions`.
- Secondary TypeScript errors: "Expected 2 arguments, but got 1." in several Jest test files calling Firebase v2 `onCall` functions (likely masked by or related to the primary Jest globals issue).
- Formatting Linter errors: Line endings (CRLF vs LF), spacing issues in multiple test files.
- IAP Warning: "Missing Apple Shared Secret or Google Service Account environment variables for IAP validation" noted in previous deployment output (separate from current test fixes).
- Some test files have complex mocking setups that require careful type handling
- Mock functions need proper typing to avoid `never` type assignments
- Dynamic imports in tests need proper async handling

## 5. Evolution of Project Decisions

- Adopted strict TypeScript linting rules requiring explicit file extensions
- Moved from `any` types to proper TypeScript typing for better type safety
- Standardized on double quotes for string literals
- Implemented proper error handling with typed catch blocks

## Recent Achievements

- ✅ Fixed all formatting issues in test files
- ✅ Improved type safety by removing `any` types from core service files
- ✅ Cleaned up unused imports and functions
- ✅ Maintained existing functionality while improving code quality

- Firebase project setup.
- `package.json` scripts for linting, building, testing, and deploying Firebase Functions.
- General structure of `sheetsService.test.ts` (Vitest-based) for testing main functions is okay.
- Unit tests in `sheetsService.test.ts` related to environment variable checks have been addressed.
- Added comprehensive unit tests for `sheetsService.ts` including JWT initialization with private key formatting.
- Added unit tests for `getRiddle` function in `firestoreService.test.ts` with comprehensive coverage.
- Improved `dailyChallenge.test.ts` with more deterministic date testing for `setCompletedDailyChallenge`.

## 2. What's Left to Build/Verify

- Continue expanding unit test coverage for other Firebase functions.
- Verification that all tests pass once the setup is stable.
- Adding comprehensive tests for all Firebase functions once the setup is stable.

## 3. Current Status

- Successfully added unit tests for multiple Firebase functions.
- Enhanced existing test suites with better coverage and type safety.
- Fixed TypeScript issues in test files by improving mock types and function call patterns.
- Test files now use proper union types for mock data to handle different document types.

## 4. Known Issues

- Minor linter warnings in `dailyChallenge.test.ts` related to spread types and require() usage (non-blocking).
- IAP Warning: "Missing Apple Shared Secret or Google Service Account environment variables for IAP validation" noted in previous deployment output (separate from current test fixes).

## 5. Evolution of Project Decisions

- Standardized Jest imports and mock usage (preferring `jest` over `vi` for Jest tests, and using `import { ... } from "@jest/globals";`).
- Improved test type safety by using union types for mock data instead of `any`.
- Enhanced test coverage for Firebase functions with edge cases and error handling.
- Added deterministic date testing using spies for better test reliability.
