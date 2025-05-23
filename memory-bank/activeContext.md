# Active Context

## 1. Current Focus

- **TypeScript Compilation Issues Fixed**: Resolved missing test files causing TypeScript compilation errors by creating the missing `generateRiddles.test.ts` unit test file and confirming that `adCallbacks.it.test.ts` is properly excluded.
- **Firebase Configuration Verification**: Confirmed that the React Native app is already properly configured to connect to the online Firebase service (qwordly-6ba44), not emulators.
- The app uses production Firebase configuration in `google-services.json` and `app.config.js`.
- No emulator connection code found in React Native source code.
- Successfully added comprehensive unit tests for Firebase functions including `sheetsService.ts`, `firestoreService.ts`, `dailyChallenge.ts`, and now `generateRiddles.ts`.
- Enhanced test coverage with proper type safety and edge case handling.
- Added new test cases to `iapValidation.test.ts` covering product ID mismatch from receipt, and failures in `markPurchaseTokenAsProcessed`, `updateUserCoins`, and Firestore updates for NO_ADS purchases.
- Added a new test case to `adCallbacks.test.ts` for missing `APPLOVIN_SDK_KEY` configuration.
- Resolved linter errors in `adCallbacks.test.ts` by improving mock typings.
- **Modified Firebase Functions Test Script**: Updated the `test` script in `firebase-functions/package.json` to remove emulator execution, so tests will target the real server.
- **Firebase Functions Testing Issues**: Encountered timeout and credential errors while running `pnpm run test`.
  - Increased Jest's global timeout in `package.json`.
  - Increased timeouts for `beforeAll` and `beforeEach` hooks in `iapValidation.it.test.ts` and `gameLogic.it.test.ts`.
  - Added `jest.setTimeout(30000)` at the beginning of `iapValidation.it.test.ts` and `gameLogic.it.test.ts`.
  - Added console warnings in test files if `GOOGLE_APPLICATION_CREDENTIALS` is not set.
- **Reverted Timeout Changes**: The above timeout adjustments did not resolve the issues. All timeout-related changes in `package.json`, `iapValidation.it.test.ts`, and `gameLogic.it.test.ts` have been reverted.
- **Configure Firebase Functions Tests for Live Environment**: Mandated that all Firebase Functions integration tests run exclusively against the live Firebase project (`qwordly-6ba44`). Emulator-based testing is no longer to be used for these tests.
  - Updated `iapValidation.it.test.ts` and `gameLogic.it.test.ts` to:
    - Explicitly initialize `admin.initializeApp({ projectId: "qwordly-6ba44" })`.
    - Remove any checks or configurations related to `FIRESTORE_EMULATOR_HOST`.
    - Added prominent error logging if `GOOGLE_APPLICATION_CREDENTIALS` is not set during initialization, as this is critical for live testing.

## 2. Recent Changes

- **Fixed TypeScript Compilation**: Created missing `generateRiddles.test.ts` unit test file with comprehensive coverage including:
  - Successful riddle generation and appending
  - Duplicate riddle handling (case-insensitive)
  - Internal duplicate detection and retries
  - Generation failure handling (null returns)
  - Maximum attempts error scenarios
  - Environment variable validation
  - Edge cases with empty existing riddles
- **Cleaned Build Output**: Removed stale compiled files from `lib` directory that were causing TypeScript to look for missing source files.
- **Firebase Configuration Analysis**: Conducted comprehensive review of Firebase setup:
  - React Native app correctly uses production Firebase project "qwordly-6ba44"
  - `google-services.json` points to live Firebase services
  - `app.config.js` contains production Firebase configuration
  - Emulator configurations only exist for Firebase Functions testing, not React Native app
- Added JWT initialization test in `sheetsService.test.ts` to verify private key formatting (`\\n` to `\n` replacement).
- Added comprehensive tests for `getRiddle` function in `firestoreService.test.ts` covering all edge cases.
- Improved `dailyChallenge.test.ts` with deterministic date testing using spies.
- Fixed TypeScript issues in test files by using union types for mock data instead of `any`.
- Resolved function call signature issues in `dailyChallenge.test.ts` for both v1 and v2 Firebase functions.
- Added specific test cases for `iapValidation.ts` to cover scenarios:
  - `iap.getPurchaseData` returns details for a different `productId` than requested.
  - `markPurchaseTokenAsProcessed` fails after successful validation and item award.
  - `updateUserCoins` fails during a coin pack purchase.
  - Firestore `userRef.update` fails during a "NO_ADS" purchase.
- Added test case to `adCallbacks.test.ts` for missing `APPLOVIN_SDK_KEY` in Firebase config.
- Corrected mock implementations and improved type safety in `adCallbacks.test.ts` to resolve all linter warnings.
- **Updated Firebase Functions Test Script**: Modified the `test` script in `firebase-functions/package.json` to remove emulator execution.
- **Attempted to fix Jest timeout errors in Firebase Functions integration tests (`iapValidation.it.test.ts`, `gameLogic.it.test.ts`) by:**
  - Modifying `test` script in `package.json` to `jest --timeout=30000`.
  - Adding explicit timeout arguments to `beforeAll` and `beforeEach` in the test files.
  - Adding `jest.setTimeout(30000)` at the top of the test files.
- Added a check and warning for the `GOOGLE_APPLICATION_CREDENTIALS` environment variable in the `beforeAll` hooks of the affected test files.
- **Reverted all timeout changes** as they did not solve the underlying problem. The "Could not load the default credentials" error persists, and hook timeouts still occur.
- **Modified Firebase Admin SDK Initialization**: In `iapValidation.it.test.ts` and `gameLogic.it.test.ts`:
  - Ensured `admin.initializeApp()` is called with `projectId: "qwordly-6ba44"`.
  - Removed all logic pertaining to Firestore emulator detection (e.g., checking `FIRESTORE_EMULATOR_HOST`).
  - Strengthened warnings/errors if `GOOGLE_APPLICATION_CREDENTIALS` is not set, emphasizing its necessity.
- Reverted previous Jest timeout adjustments in `package.json` and test files.
- The `test` script in `firebase-functions/package.json` remains configured to target the real server (no emulators).

## 3. Next Steps

- **Run Tests**: Execute `pnpm run test` within the `qwordly` root directory (which should trigger tests in `firebase-functions` via the root `package.json` if configured, or run tests directly in `firebase-functions` if that's the current setup based on previous logs).
  - **Crucial Prerequisite**: Ensure the `GOOGLE_APPLICATION_CREDENTIALS` environment variable is correctly set in the testing environment, pointing to a valid service account key JSON file with necessary permissions for the `qwordly-6ba44` Firebase project.
- If tests still fail:
  - Analyze `console.error` output for credential issues.
  - If timeouts persist despite correct credentials, investigate Firestore operations in `beforeEach` hooks for `iapValidation.it.test.ts` and `gameLogic.it.test.ts`. These might need optimization or a different strategy for managing test data in a live environment (e.g., more targeted cleanup, using unique collections/documents for test runs to avoid interference).
- **Expand Test Coverage**: Once integration tests are stable against the live environment, continue expanding unit and integration test coverage for remaining Firebase functions (`adCallbacks.ts`, `openaiService.ts`, etc.).

## 4. Active Decisions & Considerations

- **TypeScript Compilation Fixed**: Missing test files issue resolved - no further tsconfig changes needed.
- **Firebase Configuration**: Confirmed production setup is correct - no changes needed.
- React Native app connects to live Firebase project "qwordly-6ba44" as intended.
- Emulator configurations were previously isolated to Firebase Functions testing but are now entirely removed from the testing process for Firebase Functions.
- Prioritizing comprehensive test coverage for all Firebase functions to ensure reliability.
- Using union types for mock data to maintain type safety while supporting different document types.
- Implementing deterministic testing patterns using spies for date/time dependent functions.
- Running integration tests against a live Firebase environment requires careful credential management (`GOOGLE_APPLICATION_CREDENTIALS`).
- Firestore operations in `beforeEach` (cleanup and setup) can be slow when run against a live environment, leading to hook timeouts if not handled correctly.
- The decision to switch from emulator-based testing to live-service testing for Firebase Functions needs to be re-evaluated if credential and timeout issues cannot be easily resolved.
- **Live Testing Only**: All Firebase Functions integration tests will target the live Firebase project (`qwordly-6ba44`). Emulators will not be used for these tests.
- **Credential Management**: Successful live testing is entirely dependent on the correct setup of `GOOGLE_APPLICATION_CREDENTIALS`.
- **Test Data Management**: Strategies for creating and cleaning up test data in the live Firestore instance need to be robust to prevent interference and ensure test idempotency. Current `beforeEach` hooks perform deletions; their performance against a live database is a factor.

## 5. Important Patterns & Preferences

- Firebase configuration properly separated between production (React Native) and testing (Firebase Functions).
- Adherence to the instructions provided in the user's custom instructions regarding workflow and documentation.
- Test files correctly use `import { describe, expect, it, jest } from "@jest/globals";`
- Using union types instead of `any` for better type safety in mocks.
- Comprehensive edge case testing including error handling, null/undefined data, and missing documents.
- Proper file naming convention: `.test.ts` for unit tests, `.it.test.ts` for integration tests.
- Explicit Firebase Admin SDK initialization for the target project ID in test files.
- Clear error reporting for missing critical environment variables like `GOOGLE_APPLICATION_CREDENTIALS`.

## 6. Learnings & Project Insights

- **TypeScript Module Resolution**: Missing test files can cause compilation errors even with proper exclude patterns if compiled output exists in lib directory.
- **Firebase Setup**: React Native Firebase automatically connects to production services when configured with `google-services.json` - no additional configuration needed.
- The presence of emulator configurations in Firebase Functions directory does not affect React Native app connectivity.
- Expo development server (port 8082) is separate from Firebase emulators (ports 9101, 8097, 5101, 4100).
- Firebase v1 and v2 functions have different call signatures that need to be handled correctly in tests.
- Mock type safety is crucial for maintaining code quality and catching potential issues early.
- Deterministic testing using spies for date/time functions provides more reliable test results.
- Union types provide a good balance between type safety and flexibility for mock data.
- Cleaning build artifacts (lib directory) is necessary when source files are renamed or removed.
- Increasing Jest timeouts via `package.json` (`--timeout` flag), hook parameters, or `jest.setTimeout()` might not always resolve hook-specific timeouts, especially if the underlying operations (like live Firestore calls) are consistently slow or failing.
- Credential errors (`Could not load the default credentials`) are critical and will block any tests interacting with live Firebase services.
- Switching Firebase Functions tests from emulators to a live environment introduces complexities related to credentials, network latency, and data management.
- The `firebase-functions-test` library might behave differently or require different configurations when targeting live services versus emulators.
- `firebase-functions-test` does not automatically initialize `admin.initializeApp()` when running tests against a live project; manual initialization is required.
- Testing against a live Firebase environment necessitates a shift in focus from emulator configurations to robust credential management and potentially more optimized test data setup/teardown procedures.
- Explicitly checking and erroring for `GOOGLE_APPLICATION_CREDENTIALS` early can save debugging time.
