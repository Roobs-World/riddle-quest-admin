# Project Progress

## 1. What Works

### Firebase Functions

- **Test Infrastructure**: Jest testing framework properly configured with TypeScript support for unit tests. Integration tests (`*.it.test.ts`) are now strictly configured to run against the live Firebase project (`qwordly-6ba44`).
- **Unit Test Coverage**: Comprehensive unit tests for core services.

### React Native App

- Core setup for Authentication, Navigation, State Management, UI.

## 2. What's Left to Build

### Firebase Functions

- **Stabilize Live Integration Tests**: Primary focus is to ensure `iapValidation.it.test.ts` and `gameLogic.it.test.ts` pass reliably against the live Firebase project. This is dependent on the correct `GOOGLE_APPLICATION_CREDENTIALS` setup by the user.
- **Expand Test Coverage**: After stabilization, continue expanding both unit and integration test coverage.

### React Native App

- Complete core game logic, game modes, IAP, user profiles, and offline support.

### Integration

- Full API integration, real-time updates, error handling, and end-to-end tests.

## 3. Current Status

**Phase**: Backend Development - Enforcing Live Firebase Functions Testing
**Next Priority**: User to verify `GOOGLE_APPLICATION_CREDENTIALS` setup. Then, run Firebase Functions integration tests (`iapValidation.it.test.ts`, `gameLogic.it.test.ts`) to confirm they pass against the live project.
**Blockers**:

- Incorrect or missing `GOOGLE_APPLICATION_CREDENTIALS` in the test environment will cause test failures.
- Potential for timeouts in `beforeEach` hooks if live Firestore operations are excessively slow, even with correct credentials.

## 4. Known Issues

- **Integration Test Stability**: Historically, integration tests have faced timeout and credential issues when attempts were made to run them against the live environment. The current configuration changes directly address the credential aspect by enforcing live-only setup and explicit SDK initialization.

## 5. Evolution of Project Decisions

- **Critical Decision: Firebase Functions Integration Tests Exclusively on Live Environment.** All test files (`iapValidation.it.test.ts`, `gameLogic.it.test.ts`) have been modified to remove any emulator-specific logic. Firebase Admin SDK is now initialized explicitly with `projectId: "qwordly-6ba44"` and relies on `GOOGLE_APPLICATION_CREDENTIALS` for authentication.
- Previous attempts to manage test timeouts with Jest settings were reverted, as the root cause is likely credential or live environment interaction patterns.

## Recent Achievements

- ✅ **Enforced Live Firebase Testing for Integration Tests**: Modified `iapValidation.it.test.ts` and `gameLogic.it.test.ts` to solely target the live Firebase project (`qwordly-6ba44`). This included explicit Admin SDK initialization (with project ID) and removal of all emulator-related configurations and checks.
- ✅ Enhanced error reporting in test setup if `GOOGLE_APPLICATION_CREDENTIALS` are not found.
- ✅ Maintained comprehensive unit test coverage for Firebase functions.

## Firebase Functions Test Coverage

### Unit Tests

- Comprehensive for most core services.

### Integration Tests

- **Target Environment**: Exclusively the live Firebase project `qwordly-6ba44`.
- **Key Files**: `iapValidation.it.test.ts`, `gameLogic.it.test.ts`.
- **Current Status**: Awaiting execution with user-verified `GOOGLE_APPLICATION_CREDENTIALS`. The explicit live configuration is intended to resolve previous credential-related failures.
