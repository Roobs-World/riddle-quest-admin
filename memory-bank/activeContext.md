# Active Context - Qwordly Development

## Current Work Focus: Constants & Correctness (March 2026)

### Recent Improvements ✅

- **riddleGeneration.ts logger (March 2026)**: Replaced all `console.log`/`console.warn`/`console.error` in `firebase-functions/src/riddleGeneration.ts` with `logger.info`/`logger.warn`/`logger.error` from `firebase-functions/v2`. Tests mock `firebase-functions/v2` logger; 58 riddleGeneration tests pass. Aligns with profile.ts and zero raw console in Firebase Functions.
- **riddleGeneration.ts coverage (March 2026)**: Testing roadmap item completed. Coverage 53.59% → **91.71%** (target 70%+). Added tests: generateAndAppendTutorialRiddles (success, next index, store commit error, getNextTutorialIndex error), OPENAI key guard; storeDailyRiddlesInFirestore commit error; getNextDailyIndex Firestore error; generateTutorialRiddles callable (success + error); generateTodaysDailyChallenge (skip when today exists, OPENAI missing, force-generate success); generateTodaysDailyChallengeFunction (success + error). Mock firebase-admin with FieldValue.serverTimestamp for daily challenge. All 58 riddleGeneration tests pass.
- **Memory-bank task continuation (March 2026)**: (1) Console warning cleanup: jest.setup.js now suppresses console.log/warn during RN tests to avoid Firebase/logger noise; AuthService.test teardown fixed — onAuthStateChanged mock calls callback synchronously (no setTimeout), timing module mocked so safeTimeout does not schedule real timers, eliminating "Jest environment after torn down" and worker force-exit from AuthService. (2) Facebook login test refinement: added edge-case test "should proceed with sign-in when LoginManager.logOut throws during session clear". RN tests 2131 pass; Firebase Functions 410 pass.
- **skipRiddle unit tests**: Added 11 tests in `firebase-functions/src/__tests__/gameLogic.test.ts` for skipRiddle (unauthenticated, invalid game mode, user/riddle not-found, insufficient coins, already completed, classic/tutorial/challenge success, daily completed guard, unexpected error). Mock for `../achievements` (evaluateAchievements) added so getHint/Error Handling tests are stable. Implementation plan items 3–6 marked done/N/A.
- **Firebase Functions constants**: Added `firebase-functions/src/constants.ts` — `HINT_COST_COINS`, `SKIP_COST_TUTORIAL`, `SKIP_COST_CLASSIC`, `SKIP_COST_DAILY`. gameLogic.ts `getHint` and `skipRiddle` use these instead of magic numbers; comment documents sync with client `src/constants/game.ts`.
- **profile.ts logger migration**: Replaced `console.log`/`console.error` in `firebase-functions/src/profile.ts` with `logger.info`/`logger.error` from `firebase-functions/v2`. profile.test.ts updated to mock `firebase-functions/v2` logger and assert on mockLoggerInfo/mockLoggerError.
- **Hint cost fix**: NavigationStack was passing `hintCost={10}`; product spec and backend use 50 coins per hint. Added `HINT_COST_COINS = 50` to `src/constants/game.ts` and wired NavigationStack to use it. Hint cost is now correct and single-sourced.
- **Game timing constants**: Extended `src/constants/game.ts` with `SOUND_RESUME_DELAY_MS`, `WIN_FADE_OUT_DURATION_MS`, `WIN_SUCCESS_DELAY_MS`, `WIN_FADE_IN_DELAY_MS`, `WIN_FADE_IN_DURATION_MS`, `LOSS_NEGATIVE_FADE_DURATION_MS`. GameScreen and useSettings use these instead of magic numbers for sound/animation timing.
- **firestoreService.ts 100% line coverage**: Added test "should merge missing progress fields into existing partial progress" — user with `progress` object missing `dailyChallengeCurrentQuestion` and `tutorialIndex` now triggers the merge branch (lines 336–347). firestoreService is the 11th file at 100% line coverage.
- **Loading constants**: Added `src/constants/loading.ts` — `LOADING_SPINNER_SIZE = 120`, `LOADING_SPINNER_OPACITY = 0.7`, `LOADING_SPINNER_OPACITY_OVERLAY = 0.8`. Used in NavigationStack, GameScreen, LandingScreen, LoginScreen, SignUpScreen, ForgotPasswordScreen. Removes magic numbers for spinner size/opacity.
- **Game constants**: Added `src/constants/game.ts` — `SKIP_COST_DAILY = 150`, `SKIP_COST_CLASSIC = 100`, `SKIP_COST_TUTORIAL = 25`, `MODAL_CLOSE_DELAY_MS = 100`. GameScreen now uses these for skip costs and settings/help modal transition delay.
- **NavigationStack PulsingSpinner mock**: Mock now uses `accessibilityLabel="Loading"` and `accessibilityRole="progressbar"` to match real PulsingSpinner. Tests assert on these a11y props instead of visible/opacity/size in the label. Resolves known issue in progress.md (mock vs real alignment).
- **PulsingSpinner accessibility**: (previous) Added `accessibilityLabel="Loading"` and `accessibilityRole="progressbar"` to the spinner container.
- **Timing constants**: (previous) `useSettings` — `SOUND_RESUME_DELAY_MS = 500`.
- **useSettings tests**: (previous) 8 tests in `src/hooks/__tests__/useSettings.test.ts`.

---

## Previous Focus: Achievement System Completed (March 2026)

### Achievement System Implemented ✅

- **Schema**: `unlockedAchievements?: { achievementId: string; unlockedAt: number }[]` on user document (Firebase + client Zod); `ensureUserDocumentComplete` initializes when missing.
- **Server**: `firebase-functions/src/achievements.ts` — rules for first_win, wins_5/25, streak_3/7, classic_10, daily_completed, perfect_guess, tutorial_started, hint_user, first_purchase. Evaluation runs after submitGuess, getHint, and validatePurchase (NO_ADS). `appendUnlockedAchievements` in firestoreService.
- **Client**: Achievements modal (registry + FullProfileDetailsModal entry), `src/constants/achievements.ts` for UI definitions and progress; submitGuess response `newlyUnlockedAchievementIds` passed through useGameLogic.
- **Tests**: achievements.test.ts (unit), AchievementsModal.test.tsx, submitGuessLogic/firestoreService/iapValidation tests updated.
- **Firestore mock fix**: `firestoreService.test.ts` — `admin.firestore.FieldValue.arrayUnion` was undefined because the mock exposed `FieldValue` on the firestore *instance* instead of on the `firestore` function. Fixed by using `Object.assign(() => mockFirestore, { FieldValue: { arrayUnion: (...args) => args } })` as the firestore export so `appendUnlockedAchievements` tests pass. Full pre-commit (lint + RN + Functions) passes.

---

## Previous Focus: Documentation Coverage & Standards (March 2026)

### Documentation Pass Completed ✅

- **Standards**: Added a “Code Documentation Standards” section to `memory-bank/systemPatterns.md`, defining TSDoc expectations, `@fileoverview` usage, and when to add folder-level READMEs.
- **Hooks**: Documented `useGameLogic`, `useModal`, `useSettings`, and `useFirstTimeExperience` with file overviews and TSDoc describing inputs, outputs, and side effects.
- **Contexts & Navigation**: Added file-level overviews and hook docs for `AuthContext`/`useAuth` and `NavigationStack`, clarifying their orchestration roles.
- **Services**: Topped up documentation for `GameStateManager`, `AudioFeedbackManager`, `SolarSystemPreloader`, and `TextureDebugger`, and added a `src/services/README.md` describing service responsibilities.
- **Components & Screens**: Ensured key game UI components and auth screens (`Header`, `GuessGrid`, `Keyboard`, `BottomNavigationBar`, `CoinsDisplay`, `LandingScreen`, `LoginScreen`, `SignUpScreen`, `ForgotPasswordScreen`, `GameScreen`) have clear file overviews and/or TSDoc summaries.
- **Firebase Functions**: Added an entrypoint-level `@fileoverview` in `firebase-functions/src/index.ts` explaining how Cloud Functions are exported from feature modules.
- **Folder READMEs**: Added concise `README.md` files to `src/hooks/`, `src/contexts/`, and `src/services/` to document how these layers are intended to be used together.

---

## Previous Focus: Tutorial Flow (First Slice) ✅ (March 2026)

### Tutorial Flow — Interactive Onboarding (Implemented)

- **GameMode**: Added `"tutorial"` to `GameMode` in AuthContext; `fetchCurrentRiddle` now fetches from `fetchTutorialRiddleFromFirestore(player.progress.tutorialIndex ?? 0)`. If no tutorial riddle exists, falls back to classic riddle and sets `gameMode` to `"classic"`.
- **NavigationStack**: `handleNextLevel` for `gameMode === "tutorial"` advances `tutorialIndex` via `updateTutorialIndexInFirestore`, fetches next tutorial riddle; if none, switches to daily and fetches daily riddle.
- **GameScreen**: Passes `"tutorial"` to `useGameLogic` when `gameMode === "tutorial"` (submitGuess already supports tutorial server-side).
- **WelcomeModal**: Optional `onStartTutorial` prop; when provided, shows "Start Tutorial" and "Skip to Play". GameScreen passes callback that sets `gameMode("tutorial")` and `fetchCurrentRiddle(playerData, "tutorial")` so first-time users can start the tutorial from the welcome modal.
- **Tests**: All 2,111 RN + 386 Firebase Functions tests passing.

### Next Steps (Tutorial Flow) — COMPLETED ✅

- **Tutorial UI**: Header shows "Tutorial" label and step indicator ("Step X of Y" or "Step X") when `gameMode === "tutorial"`; GameScreen passes `isTutorial`, `tutorialStep`, `tutorialTotalSteps` (fetched via `getTutorialRiddleCount` when in tutorial mode).
- **Start Tutorial gating**: WelcomeModal accepts `showStartTutorial`; GameScreen calls `FirestoreService.getTutorialRiddleCount()` before showing the welcome modal and passes `showStartTutorial: count > 0` so "Start Tutorial" is only shown when tutorial riddles exist.

### Lint & Pre-commit (March 2026)

- Fixed 25 lint errors that were blocking pre-commit: unused vars/imports, mock displayName, react-hooks/purity in StarryBackground (useState lazy init), react-hooks/refs in PulsingSpinner (useState for animValues). Pre-commit (lint + 2,111 RN + 386 Functions tests) now passes.

---

## Previous Focus: ALL MEMORY BANK TASKS COMPLETED ✅ (March 2026)

### Comprehensive Task Completion Push ✅

- **Firebase Functions tests**: 386/386 passing (+45 new tests)
- **React Native tests**: 2111/2111 passing, 0 failing (99 suites)
- **Total tests**: 2497 passing, 0 failing

### Coverage Improvements (March 2026)

- **dailyChallenge.ts**: 56.77% → **100%** line coverage (+20 new tests)
- **firestoreService.ts**: 61.87% → **98.12%** line coverage (+25 new tests)
- **Overall Firebase Functions**: 56.24% → **61.65%** (+5.41 percentage points)

### Bug Fixes Applied (March 2026)

1. **gamesPlayed stat bug**: Was incrementing on every guess submission; now only increments when game ends (`gameOver = true`). This also fixed inflated `winRate` calculations.
2. **Hint tracking**: Added `totalHintsUsed` field to `PlayerStatsSchema` and `getHint` function now tracks hint usage in user stats via `updateUserStats`.

### Console.log Cleanup Completed (March 2026)

- **RiddleInitializationService.ts**: 10 `console.log` → `logger.debug`/`logger.info`/`logger.warn`
- **RiddleDataService.ts**: 11 `console.log`/`console.warn` → `logger.debug`/`logger.warn`
- **errorUtils.ts**: 5 `console.error` → `logger.error`
- **submitGuessLogic.ts**: 7 `console.log`/`console.error` → `functions.logger.info`/`functions.logger.error`/`functions.logger.debug`
- **Zero raw `console.log/warn` remaining** in `src/` production code (only `logger.ts` itself)

### Structurally Unreachable Lines Documented

- `iapConfig.ts:185-186` — module-level auto-init guard; `JEST_WORKER_ID` always set during tests
- `iapPlatformValidator.ts:141` — dead code fallback after exhaustive platform check
- `submitGuessLogic.ts:122,125` — dead code; feedback always initialized to correct length
- `submitGuessLogic.ts:223-224` — logically unreachable branch (`newTotalGuessesInWins` always > 0 when `isCorrect`)
- `submitGuessLogic.ts:299-304` — `onCall` wrapper requires Firebase runtime

---

## Previous Focus: ALL RN TESTS PASSING ✅ (March 2026)

### Major Test Infrastructure Fixes (March 2026)

#### jest.config.js: Switched to react-native preset
- Changed from `preset: null, testEnvironment: "jsdom"` to `preset: "react-native"`
- The react-native preset provides proper test environment (`react-native-env.js`), resolver, and host component mappings
- Fixed `getByPlaceholderText`, `getByDisplayValue`, and other RNTL queries that depend on proper host component resolution

#### jest.setup.js: Fixed TurboModuleRegistry for RN 0.84.1
- Added `DeviceInfo` module mock with `getConstants()` returning proper Dimensions data
- Added `PlatformConstants` and `SourceCode` module mocks
- This fixes the `Cannot read properties of undefined (reading 'getConstants')` crash that occurred when `react-native` index.js lazy property getters fired

#### Eliminated `jest.mock("react-native", ...)` anti-pattern
- Removed all `jest.mock("react-native", () => ({ ...jest.requireActual("react-native"), ... }))` patterns
- This pattern caused circular loading crashes in RN 0.84.1 due to lazy property getters
- Replaced with targeted `jest.spyOn(Alert, "alert")` for Alert mocking
- Added proper component-level mocks (responsive, styles, ModalBg, WideButton, CloseButton)

#### Test assertion fixes across 22 suites
- Fixed button text mismatches ("Save Changes" → "Save", "Cancel" → removed)
- Fixed testID references ("modal" → "mock-modal")
- Fixed `typeof` checks for React.memo components ("function" → "object")
- Fixed schema validation tests (added missing required fields)
- Fixed source-code assertion tests (`console.error` → `logger.error`)
- Fixed audio optimization edge case expectations
- Added missing Firebase module mocks for NavigationStack
- Added react-native-safe-area-context mock for CoinShopModal
- Wrapped LandingScreen tests in ModalProvider
- Fixed react-native-reanimated mock to avoid lazy getter issues

---

## Previous Focus: Expo SDK 55 Upgrade Complete

### Expo SDK 55 Upgrade Completed ✅ (March 2025)

- **Migrated** expo-av → expo-audio (expo-av removed in SDK 55)
- **Updated** app.config.js: removed newArchEnabled (New Arch mandatory), replaced expo-av plugin with expo-audio
- **Rewrote** SoundManager and audioOptimization for expo-audio API (createAudioPlayer, setAudioModeAsync)
- **Updated** jest.setup.js to mock expo-audio instead of expo-av
- **Note**: New Architecture is now mandatory; development builds required (Expo Go may lag)

---

## Previous Focus: Logger Infrastructure & Production Logging

### Logger Infrastructure Completed ✅ (March 2025)

- **Created** `src/utils/logger.ts` — centralized logger that gates debug/info/warn in production
- **Updated** FirestoreService, SoundManager, AuthContext, GameScreen to use logger
- **Rationale**: Prevents JSI crashes from excessive logging (SoundManager was root cause); production builds suppress verbose logs
- **Pattern**: `logger.debug`/`logger.info`/`logger.warn` only emit when `__DEV__` or `NODE_ENV !== 'production'`; `logger.error` always emits

### Major Package Update Completed ✅ (January 2025)

Successfully updated all npm packages to latest versions with full compatibility restored.

### Current Status

- **Package Updates**: ✅ All dependencies updated to latest versions
- **React Native**: ✅ Upgraded to 0.83.1 with Jest compatibility
- **Firebase v23 Migration**: ✅ All packages updated to latest Firebase v23
- **Jest Configuration**: ✅ Fixed for React Native 0.83.1 ES modules
- **Modal System**: ✅ Consolidated and organized
- **Hint Functionality**: ✅ Implemented in Bottom Navigation
- **3D Solar System**: ✅ Upgraded to individual GLB models
- **Test Coverage**: 62.27% with 275 tests (excellent foundation)

---

## 📋 TODOs Status

### ✅ All Medium Priority Tasks Completed (March 2026)

#### 1. Terms & Privacy Policy Navigation ✓
#### 2. Admin Authorization Check ✓
#### 3. IAP Product ID Configuration ✓
#### 4. IAP Environment Variables ✓
#### 5. Ad Client Callback Correlation ✓
#### 6. validatePurchase Placeholder Removed ✓

#### 7. Console.log Cleanup — COMPLETE ✅
- **All production files migrated** to logger utility (RN + Firebase Functions)
- **Zero raw `console.log/warn`** remaining in `src/` production code
- **errorUtils.ts** now uses `logger.error` instead of `console.error`

#### 8. Test Coverage Improvement — COMPLETE ✅
- **Overall**: 56.24% → **61.65%** (424 tests), 11 files at 100%
- **dailyChallenge.ts**: 56.77% → **100%**
- **firestoreService.ts**: 61.87% → **100%**
- **riddleGeneration.ts**: 53.59% → **91.71%** (target 70%+ met); console → logger (firebase-functions/v2) March 2026

#### 9. Failing Tests Resolution — COMPLETE ✅
- **All 2497 tests passing** (2111 RN + 386 Firebase Functions)
- **0 failing tests** across all suites

#### 10. User Statistics Accuracy — COMPLETE ✅
- **Fixed**: `gamesPlayed` was incrementing per guess; now increments per game (`gameOver` only)
- **Fixed**: `winRate` calculation was using inflated `gamesPlayed` count

#### 11. Hint Tracking — COMPLETE ✅
- **Added**: `totalHintsUsed` field to `PlayerStatsSchema`
- **Implemented**: `getHint` function now calls `updateUserStats` to track `totalHintsUsed`

### 🟢 Feature Roadmap (Verified)

- **Server-side Ad Validation**: ✅ Completed in prior architecture
- **IAP Validation**: ✅ Complete with platform validation
- **User Statistics**: ✅ Reviewed and fixed — `gamesPlayed` and `winRate` now accurate
- **Hint Tracking**: ✅ Reviewed and implemented — `totalHintsUsed` tracked in stats

---

## 🚀 Feature Roadmap (What's Left to Build)

### High Priority Features
1. **Advanced Analytics** — User behavior tracking and game metrics
2. **Offline Mode** — Local game state and sync capabilities
3. **Tutorial Flow polish** — Tutorial-specific UI (step indicator, "Tutorial" in header) ✅; optional gating on tutorial riddle availability ✅. First slice done.

### Medium Priority Features
4. **Social Features** — Friend systems and social sharing
5. **Achievement System** — ✅ Implemented (unlock rules, modal, submitGuess/getHint/IAP evaluation, tests)
6. **Performance Optimization** — Asset loading and memory management

### Low Priority Features
7. **Advanced Animations** — More sophisticated visual effects
8. **Customization Options** — Themes and personalization
9. **Advanced Statistics** — Detailed player analytics dashboard

---

## Project Context

- **Framework**: React Native 0.84.1 with NativeWind, TypeScript, Firebase v23
- **Design System**: Modular architecture with design tokens
- **Testing**: Jest 30.2.0 with `preset: "react-native"` — 2,497 tests, 0 failures
- **Architecture**: Clean separation of concerns with Firebase Functions backend

## Important Patterns

### Proper Style Imports
```typescript
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../styles";
```

### Firebase Modular API (Post-Migration)
```typescript
import { getFirestore } from "@react-native-firebase/firestore";
import { getApp } from "@react-native-firebase/app";
getFirestore(getApp()).collection("users").doc(userId);
```

### Modal Style Usage
```typescript
const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
});
```
