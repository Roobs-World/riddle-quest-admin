# Firebase Functions Testing Scripts

This directory contains utility scripts for automated testing with Firebase emulators.

## Automated Test Script

The `test-with-emulators.js` script provides automated testing that:

1. **Starts Firebase emulators** (Firestore + Auth)
2. **Waits for emulators to be ready** (with port checking)
3. **Runs all tests** (unit tests + integration tests)
4. **Cleans up emulators** when done

### Usage

```bash
# Run all tests (unit + integration with emulators)
npm run test:auto

# Run only unit tests (no emulators needed)
npm run test:auto -- --unit-only

# Run only integration tests (with emulators)
npm run test:auto -- --integration-only
```

### Available npm Scripts

```bash
# Manual testing (requires manual emulator setup)
npm run test                    # All tests without emulators
npm run test:unit               # Unit tests only
npm run test:emulator           # Integration tests (requires running emulators)
npm run test:integration        # Integration tests (requires running emulators)

# Automated testing (handles emulator setup automatically)
npm run test:auto               # Automated full test suite

# Emulator management
npm run emulators:start         # Start emulators manually
npm run emulators:kill          # Stop emulators manually
```

### Features

- ✅ **Automatic emulator startup** - No manual emulator management needed
- ✅ **Port availability checking** - Waits for emulators to be ready before testing
- ✅ **Graceful cleanup** - Automatically stops emulators when done
- ✅ **Signal handling** - Properly handles Ctrl+C and other termination signals
- ✅ **Colored output** - Easy-to-read colored console output
- ✅ **Error handling** - Comprehensive error reporting and exit codes
- ✅ **Flexible options** - Run unit tests only, integration only, or both

### Emulator Ports

- **Firestore**: `127.0.0.1:8099`
- **Auth**: `127.0.0.1:9099`

### Test Data Persistence

The script uses `.emulator-data` directory to:

- Import existing test data when starting emulators
- Export test data when stopping emulators
- Maintain test state between runs

### Troubleshooting

If tests fail to connect to emulators:

1. Check that Firebase CLI is installed: `firebase --version`
2. Ensure you're in the `firebase-functions` directory
3. Verify emulator ports aren't in use by other processes
4. Try running emulators manually first: `npm run emulators:start`

### Manual Emulator Testing

If you prefer manual control:

```bash
# Terminal 1: Start emulators
npm run emulators:start

# Terminal 2: Run tests
npm run test:integration
```
