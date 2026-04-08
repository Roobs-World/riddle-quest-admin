# Project Progress

## Current Status: Achievement System Implemented (March 2026)

### Test Results

- **RN tests**: 2,119 passing, 0 failing (100 suites)
- **Firebase Functions tests**: 386+ passing (gameLogic.test.ts: 32 tests including 11 skipRiddle tests; 61.65% coverage, 11 files at 100%)
- **Total**: 2,505+ tests, 0 failures
- **Pre-commit hook**: Fully functional — commits blocked on test failure

### Coverage Improvements (March 2026)

| File | Before | After | Notes |
|------|--------|-------|-------|
| dailyChallenge.ts | 56.77% | **100%** | +20 tests, all functions covered |
| firestoreService.ts | 61.87% | **100%** | +26 tests, partial progress merge edge case |
| Overall Firebase Functions | 56.24% | **61.65%** | +45 tests |

### Bug Fixes (March 2026)

| Bug | File | Fix |
|-----|------|-----|
| `gamesPlayed` incrementing per guess | submitGuessLogic.ts | Now only increments when `gameOver = true` |
| `winRate` inflated by per-guess counting | submitGuessLogic.ts | Fixed by correcting `newGamesPlayed` calculation |
| No hint usage tracking | gameLogic.ts + firestoreSchemas.ts | Added `totalHintsUsed` to stats; `getHint` now calls `updateUserStats` |

### Console.log Cleanup (March 2026)

- RiddleInitializationService.ts, RiddleDataService.ts, errorUtils.ts, submitGuessLogic.ts — all migrated to logger
- **riddleGeneration.ts** — all console.log/warn/error migrated to `firebase-functions/v2` logger (March 2026); tests mock logger
- Zero raw `console.log/warn` remaining in production `src/` and Firebase Functions `src/` code

### Files at 100% Line Coverage (11 total)

profanityFilter.ts, firestoreSchemas.ts, openaiService.ts, profile.ts, iapReceiptService.ts, dailyScheduler.ts, adCallbacks.ts, iapValidation.ts, dailyChallenge.ts, index.ts, **firestoreService.ts**

### Structurally Unreachable Lines (Documented)

- `iapConfig.ts:185-186` — module-level auto-init guard; `JEST_WORKER_ID` always set during tests
- `iapPlatformValidator.ts:141` — dead code fallback after exhaustive platform check
- `submitGuessLogic.ts:122,125` — dead code; feedback always initialized to correct length
- `submitGuessLogic.ts:223-224` — logically unreachable branch (`newTotalGuessesInWins` always > 0 when `isCorrect`)
- `submitGuessLogic.ts:299-304` — `onCall` wrapper requires Firebase runtime

---

### Documentation Improvements (March 2026)

- Added a “Code Documentation Standards” section to `systemPatterns.md` to codify TSDoc, `@fileoverview`, and folder README usage.
- Documented core hooks (`useGameLogic`, ad hooks, modal/settings/first-time hooks) with clear file overviews and TSDoc comments.
- Documented `AuthContext`, `useAuth`, and `NavigationStack` to clarify their roles in auth, riddle loading, and navigation orchestration.
- Improved documentation for services (`GameStateManager`, `AudioFeedbackManager`, `SolarSystemPreloader`, `TextureDebugger`) and added `README.md` files for `src/hooks/`, `src/contexts/`, and `src/services/`.
- Ensured key UI components and screens (game header/grid/keyboard/navigation, main auth and game screens) have descriptive summaries and documented props where non-trivial.

---

## What Works

### Core Game Functionality

- Keyboard input, riddle gameplay with 5-guess grid and color feedback
- Authentication (email/password, Google Sign-In, Facebook login)
- Game state management, coin system, game completion flows
- Daily Challenges with scheduled riddle generation
- Classic Mode with sequential, progressively unlocked levels
- Hint system (50 coins per hint) wired to bottom navigation
- Sound/haptics feedback throughout the game
- 3D solar system background with individual GLB models (11 models)

### Technical Infrastructure

- Firebase integration: Firestore, Auth, Functions, Analytics, Storage
- React Navigation stack with auth guards
- Jest 30.2.0 testing with `preset: "react-native"` and TurboModule mocks
- Husky pre-commit enforcement (lint + all tests)
- Logger utility preventing JSI crashes in production
- Expo SDK 55 with mandatory New Architecture

### Architecture

- Modal system organized by category (game/, settings/, help/) with centralized registry
- Service layer pattern (FirestoreService, RiddleService, AuthService, etc.)
- Firebase modular API (`getFirestore()`, `getAuth()`, etc.)
- Server-authoritative game logic (submitGuess, getHint, spendCoins)
- Zod schema validation for Firestore documents

---

### Tutorial Flow (March 2026) — First Slice + Polish ✅

- **AuthContext**: `GameMode` includes `"tutorial"`; `fetchCurrentRiddle` loads tutorial riddle by `tutorialIndex`, with fallback to classic when none available.
- **NavigationStack**: Tutorial win advances to next tutorial level or switches to daily when no more levels.
- **WelcomeModal**: "Start Tutorial" / "Skip to Play" when `onStartTutorial` and `showStartTutorial` true; gated by `FirestoreService.getTutorialRiddleCount()` so "Start Tutorial" only shown when tutorial riddles exist.
- **GameScreen**: Passes `gameMode === "tutorial"` to `useGameLogic`; fetches tutorial count for welcome modal and for header; passes `isTutorial`, `tutorialStep`, `tutorialTotalSteps` to Header.
- **Header**: Shows "Tutorial" label and step indicator ("Step X of Y" or "Step X") when `isTutorial` is true.
- **FirestoreService**: `getTutorialRiddleCount()` added for gating and header step total.

### Constants & hint cost fix (March 2026) ✅

- **Hint cost**: NavigationStack previously passed `hintCost={10}`; backend and product spec use 50 coins. Added `HINT_COST_COINS = 50` to `src/constants/game.ts`; NavigationStack now uses it. Hint cost is correct and single-sourced.
- **Game timing**: `src/constants/game.ts` extended with SOUND_RESUME_DELAY_MS, WIN_* and LOSS_* duration/delay constants. GameScreen and useSettings use these for sound and win/loss animation timing (no magic numbers).
- **Backend constants**: `firebase-functions/src/constants.ts` added with HINT_COST_COINS, SKIP_COST_*; gameLogic getHint/skipRiddle use them. profile.ts migrated from console to Firebase logger; profile tests assert on logger mock.

### useSettings hook tests (March 2026) ✅

- **Added** `src/constants/loading.ts`: LOADING_SPINNER_SIZE, LOADING_SPINNER_OPACITY, LOADING_SPINNER_OPACITY_OVERLAY — used in NavigationStack and all screens that show PulsingSpinner.
- **Added** `src/constants/game.ts`: SKIP_COST_DAILY/CLASSIC/TUTORIAL, MODAL_CLOSE_DELAY_MS (and later HINT_COST_COINS, sound/win/loss timing constants) — used in GameScreen, NavigationStack, useSettings.
- **NavigationStack test**: PulsingSpinner mock aligned with real component (accessibilityLabel="Loading", accessibilityRole="progressbar").
- **Added** `src/hooks/__tests__/useSettings.test.ts`: 8 unit tests for useSettings (API shape, defaults, load from AsyncStorage, toggle sound/haptics with persistence and SoundManager, load error logging). AsyncStorage mock returns Promises so hook’s `.catch()` is valid.

### Achievement System (March 2026) ✅

- **Backend**: `firebase-functions/src/achievements.ts` — `evaluateAchievements(userId, context)` runs after submitGuess, getHint (hint use), and validatePurchase (no-ads). User document field `unlockedAchievements: { achievementId, unlockedAt }[]`; `ensureUserDocumentComplete` and Firestore schema extended.
- **Client**: `src/constants/achievements.ts` — definitions (id, name, description, criteria, threshold); `AchievementsModal` lists all achievements with locked/unlocked state and progress; entry from FullProfileDetailsModal ("Achievements" button). submitGuess response includes `newlyUnlockedAchievementIds`; useGameLogic passes it through on win outcome.
- **Tests**: `firebase-functions/src/__tests__/achievements.test.ts`, `src/components/modals/settings/__tests__/AchievementsModal.test.tsx`; submitGuessLogic and iapValidation tests updated for new behavior.

### Performance Optimizations (March 2026) ✅

- **useGameLogic**: `processGuess` wrapped in `useCallback` with `[riddleId, gameMode, hasUsedContinue, attemptsUsed, guesses.length]` to stabilize references and reduce child re-renders.
- **GameScreen**: Fixed `handlePayAndPlay` mutating `iapProducts` (now `[...iapProducts].sort()`); memoized `isSubmitDisabled` with `useMemo`; wrapped in `React.memo(GameScreenInner)`.
- **AuthContext**: Context value memoized with `useMemo`; `login` and `logout` wrapped in `useCallback` to keep value identity stable when only other state changes.
- **FirestoreService**: In-memory session cache for `fetchDailyRiddleFromFirestore`, `fetchClassicRiddleFromFirestore`, and `fetchTutorialRiddleFromFirestore` (max 50 entries, FIFO). Reduces repeated Firestore reads when switching game mode or re-fetching same riddle. Exported `clearRiddleCache()` for tests.

## What's Left to Build

### High Priority

1. **Advanced Analytics** — User behavior tracking and game metrics
2. **Offline Mode** — Local game state and sync capabilities
3. **Tutorial Flow** — Polish done: tutorial-specific UI (step indicator, "Tutorial" in header) and gating on tutorial riddle availability ✅

### Medium Priority

4. **Social Features** — Friend systems and social sharing
5. **Achievement System** — Unlock criteria and badge mechanics ✅ (March 2026)
6. **Performance Optimization** — Asset loading and memory management (partial: memoization, riddle cache, and GameScreen/AuthContext optimizations done)

### Low Priority

7. **Advanced Animations** — More sophisticated visual effects
8. **Customization Options** — Themes and personalization
9. **Advanced Statistics** — Detailed player analytics dashboard

### Testing Roadmap

| File | Current | Target | Notes |
|------|---------|--------|-------|
| riddleGeneration.ts | **91.71%** | 70%+ ✅ | +tests: tutorial (generateAndAppend, getNextIndex, store), daily/tutorial store errors, generateTodaysDailyChallenge + callable, getNextDailyIndex error; FieldValue mock for daily challenge |
| submitGuessLogic.ts | 94.65% | ~95% | Remaining lines are dead code |
| iapConfig.ts | 97.82% | ~98% | Lines 185-186 structurally unreachable |
| iapPlatformValidator.ts | 97.72% | ~98% | Line 141 is dead code |
| firestoreService.ts | **100%** | ✅ Done | Added test for partial progress merge (lines 338–347) |

---

## Known Issues (Minor)

1. Resolved: Facebook login test refinement — added edge case "should proceed with sign-in when LoginManager.logOut throws during session clear" (March 2026).
2. Resolved: Console warning cleanup — jest.setup.js suppresses console.log/warn during tests; AuthService test teardown fixed (onAuthStateChanged sync mock, timing mock, no more "access after torn down") (March 2026).
3. Resolved: PulsingSpinner mock now uses accessibilityLabel="Loading" and accessibilityRole="progressbar"; tests assert on these (March 2026).

## Lint (March 2026)

- **Pre-commit**: Lint + RN tests + Firebase Functions tests all pass (25 lint errors fixed).
- Fixes applied: clear-cache.js global window; unused imports/vars (firestoreService.test, migrationScript.test, SettingsIcon, SoundManager, audioOptimization); mock displayName in 4 modal tests; useRewardedAds dependency array `[playerData]` for React Compiler; StarryBackground star generation moved to useState lazy init; PulsingSpinner animValues changed from useRef to useState for refs-during-render rule.

---

## Completed TODOs

### Medium Priority (All Done — March 2026)

- Terms & Privacy Policy navigation (external URLs via Linking API)
- Admin authorization check (custom claims + Firestore fallback)
- IAP Product ID configuration and environment variables
- Ad client callback correlation (full S2S with AppLovin MAX)
- validatePurchase placeholder removed
- Console.log cleanup — all production files use logger
- Test coverage improved to 61.65%
- All 2,497 tests passing
- User statistics accuracy (gamesPlayed bug fixed)
- Hint tracking implemented (totalHintsUsed stat)

---

## Milestone History

| Date | Milestone |
|------|-----------|
| Mar 2026 | Performance: useCallback(processGuess), AuthContext/GameScreen memoization, Firestore riddle session cache, GameScreen React.memo |
| Mar 2026 | Tutorial flow first slice: tutorial mode in AuthContext/NavigationStack, WelcomeModal Start Tutorial, 2,497 tests passing |
| Mar 2026 | All memory bank tasks completed; 2,497 tests, 0 failures; 10 files at 100% coverage |
| Mar 2026 | All 2,111 RN tests fixed (jest.config.js preset, TurboModule mocks, 22 suites fixed) |
| Mar 2025 | Expo SDK 55 upgrade (expo-av → expo-audio, New Architecture mandatory) |
| Mar 2025 | Logger infrastructure (`src/utils/logger.ts`) preventing JSI crashes |
| Jan 2025 | Major package update (RN 0.83.1, React 19, Firebase v23, Jest 30) |
| Jan 2025 | Firebase v22→v23 modular API migration (16+ files, 50+ function calls) |
| — | 3D solar system upgraded to 11 individual GLB models |
| — | Modal architecture reorganized (game/, settings/, help/ categories) |
| — | Hint functionality wired to bottom navigation bar |
| — | Critical JSI crash bug fixed (SoundManager status callback removed) |
| — | Test coverage milestone: 52.48% → 62.27% (+275 tests) |
