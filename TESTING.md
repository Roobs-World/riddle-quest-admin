# Testing Documentation for Qwordly

## Overview

The Qwordly project has a **unified test command** that runs all tests with automatic emulator management and Firestore initialization. The test suite includes both Firebase Functions (backend) tests and React Native tests.

## Quick Start

Run ALL tests with a single command:

```bash
pnpm run test
```

That's it! This command will:

1. Start Firebase emulators automatically
2. **Initialize Firestore with test data** (riddles and users)
3. Run all Firebase Functions tests (unit + integration)
4. Run all React Native tests
5. Stop emulators when complete
6. Show colored output for better visibility

## Current Test Status

### ✅ Firebase Functions Tests - WORKING

- **218 tests** - All passing
- Comprehensive coverage of backend business logic
- Integration tests with emulator support

### ⚠️ React Native Tests - RUNNING WITH FAILURES

- **172 tests** - Infrastructure working, but test logic issues remain
- **Status**: Tests execute successfully (no transformation errors)
- **Passing**: 126 tests
- **Failing**: 46 tests due to test logic issues:
  - **ErrorUtils test (1)**: AppError code field expectation mismatch
  - **SoundManager tests (30)**: Mock sound instances not being properly initialized
  - **RiddleService tests (14)**: Auth mock \_\_setMockUser method accessibility issues
  - **WideButton test (1)**: SVG import causing getColorScheme error
  - **AuthContext test (1)**: SVG import causing getColorScheme error

### 📊 Overall Test Summary

- **Total Tests**: 390
- **Passing**: 344 tests (88%)
- **Failing**: 46 tests (12%)
- **Infrastructure**: ✅ Working properly for both test suites
- **Next Steps**: Fix individual test logic issues in React Native tests

## Test Infrastructure Details

### React Native Test Configuration

The React Native tests are configured with:

- Custom babel configuration with Flow type stripping
- Complete React Native mock to avoid transformation issues
- Manual mocks for Firebase modules
- Custom Jest setup avoiding problematic presets

### Firebase Functions Test Configuration

The Firebase Functions tests include:

- Unit tests that run without emulators
- Integration tests that require emulators
- Automatic emulator management
- Pre-populated test data

## Troubleshooting

### Common Issues

1. **Emulator Connection Issues**

   ```bash
   # Kill any running emulators
   taskkill /F /IM "java.exe" /T  # Windows
   pkill -f "firebase.*emulators"  # Mac/Linux
   ```

2. **Test Failures**

   - React Native tests have known failures due to mock setup issues
   - Firebase Functions tests should all pass
   - If Firebase tests fail, ensure emulators are not already running

3. **Memory Issues**
   - Close other applications if tests run slowly
   - Emulators can be resource-intensive

## Individual Test Commands

If you need to run specific test suites:

```bash
# Run only Firebase Functions tests
cd firebase-functions && pnpm test

# Run only React Native tests (will show failures)
npx jest --config jest.config.cjs --projects "React Native"

# Run tests with verbose output
npm test -- --verbose
```

## Next Steps for Test Improvement

1. **Fix SoundManager Mock**: The `mockSoundInstances` array needs proper initialization
2. **Fix Auth Mock**: Ensure `__setMockUser` method is accessible in all test contexts
3. **Fix SVG Imports**: Mock or configure react-native-css-interop for test environment
4. **Update Error Expectations**: Align test expectations with actual error handling behavior

## Test Data Initialization

The test suite automatically populates the Firestore emulator with:

### Riddle Data

```javascript
{
  riddleNumber: 1,
  answer: "test",
  hint1: "First hint",
  hint2: "Second hint",
  hint3: "Third hint",
  difficulty: "medium",
  dailyDate: "2024-01-01",
  isPlayable: true
}
```

### User Data

```javascript
{
  uid: "test-user-123",
  username: "testuser",
  coins: 100,
  totalScore: 0,
  riddlesCompleted: [],
  hintsUsed: {},
  createdAt: Timestamp.now()
}
```

## How Testing Works

### Unified Test Script (`scripts/test-all.js`)

The script handles the complete test workflow:

1. **Emulator Management**

   - Kills any existing emulator processes
   - Starts Firebase emulators (Firestore & Auth)
   - Waits for emulators to be ready

2. **Data Initialization**

   - Uses `firebase-admin` to populate test data
   - Creates test riddles and users in Firestore
   - Ensures consistent test environment

3. **Test Execution**

   - Runs Firebase Functions tests first
   - Then runs React Native tests
   - Shows progress with colored output

4. **Cleanup**
   - Stops emulators gracefully
   - Handles SIGINT/SIGTERM for clean shutdown

## Known Issues and Limitations

### React Native Test Failures

Some React Native tests are failing due to:

- Mock differences (e.g., missing `getColorScheme` from react-native-css-interop)
- Outdated test assertions that need updates
- SoundManager tests expecting different mock structure

These are test logic issues, not infrastructure problems. The tests are running successfully.

## Running Specific Test Suites

If you need to run tests separately:

### Firebase Functions Only

```bash
cd firebase-functions && pnpm run test
```

### React Native Only

```bash
npm test -- --projects "React Native"
```

## Continuous Integration

The test suite is designed for CI/CD pipelines:

- Single command execution
- Automatic emulator lifecycle management
- Exit codes properly indicate success/failure
- No manual intervention required
