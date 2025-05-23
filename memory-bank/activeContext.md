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
- **Configure Firebase Functions Tests for Live Environment using .env**: Mandated that all Firebase Functions integration tests run exclusively against the live Firebase project (`qwordly-6ba44`). Emulator-based testing is no longer used.
  - Installed `dotenv` package in `firebase-functions`.
  - Updated `iapValidation.it.test.ts` and `gameLogic.it.test.ts` to:
    - Load `.env` file (expected to be in `firebase-functions/.env`).
    - Read `GOOGLE_APPLICATION_CREDENTIALS_PATH` from `process.env`.
    - Initialize `admin.initializeApp({ credential: admin.credential.cert(serviceAccountPath), projectId: "qwordly-6ba44" })`.
    - Removed previous direct checks for `GOOGLE_APPLICATION_CREDENTIALS` environment variable, now relying on the path from `.env`.
    - Added prominent error logging if `GOOGLE_APPLICATION_CREDENTIALS_PATH` is not set or if SDK initialization fails.

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
- **Switched to .env for Service Account Path**:
  - Installed `dotenv` in `firebase-functions`.
  - Modified Firebase Admin SDK initialization in `iapValidation.it.test.ts` and `gameLogic.it.test.ts` to load the service account key path from `GOOGLE_APPLICATION_CREDENTIALS_PATH` in `firebase-functions/.env`.
  - This approach replaces the direct reliance on the `GOOGLE_APPLICATION_CREDENTIALS` environment variable for test file configuration, centralizing it into the `.env` file.
- Ensured `admin.initializeApp()` is called with `projectId: "qwordly-6ba44"` and the credential from the specified path.
- Removed all logic pertaining to Firestore emulator detection.

## 3. Next Steps

- **User Action: Verify `firebase-functions/.env` file**:
  - Ensure `firebase-functions/.env` exists.
  - Ensure it contains the line `GOOGLE_APPLICATION_CREDENTIALS_PATH="/actual/path/to/your/qwordly-admin-sdk.json"`, replacing the example path with the correct full path to the service account key file.
- **Run Tests**: Execute `pnpm run test` (likely from `firebase-functions` directory as per last successful `dotenv` install, or from root `J:\qwordly` if the root `package.json` script handles it).
  - The tests will now attempt to initialize Firebase Admin SDK using the path specified in `firebase-functions/.env`.
- If tests fail:
  - Check console output for errors related to `GOOGLE_APPLICATION_CREDENTIALS_PATH` not being found or SDK initialization failure (the new error logs should make this clear).
  - Verify the path in `.env` is correct and the JSON file is valid and has necessary permissions.
  - If timeouts persist with correct credentials, investigate Firestore operations in `beforeEach` hooks.

## 4. Active Decisions & Considerations

- **Live Testing Only with .env Configuration**: All Firebase Functions integration tests target the live Firebase project (`qwordly-6ba44`), with service account credentials managed via `GOOGLE_APPLICATION_CREDENTIALS_PATH` in `firebase-functions/.env`.
- **Credential Path Management**: The `.env` file in `firebase-functions` is now the source of truth for the service account key file path for tests.
- **Test Data Management**: Strategies for creating and cleaning up test data in the live Firestore instance remain important.

## 5. Important Patterns & Preferences

- Using `dotenv` for managing environment-specific configurations like credential paths in test environments.
- Explicit Firebase Admin SDK initialization using `admin.credential.cert()` with a file path for tests.
- Clear error reporting for missing critical configurations.

## 6. Learnings & Project Insights

- Using `dotenv` allows for more flexible and project-contained configuration of sensitive paths like service account keys, rather than relying solely on globally set environment variables for local testing.
- `admin.credential.cert()` is the method to use when initializing Firebase Admin SDK with a service account key file path.
