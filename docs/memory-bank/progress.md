# Project Progress

## Current Status: Docs Task Continuation In Progress (May 2026)

- The active docs task slice is now owned by Codex and tracked in `docs/tasks.html`.
- Work-in-progress ownership marker: the current Codex thread owns the open docs backlog pass, the generated task index, and the issue docs listed in `docs/memory-bank/activeContext.md`. Please avoid parallel edits to the tracked files until the refresh lands.
- Current owned files for this pass: `docs/issues/0001-android-emulator-firebase-qa-plan.md`, `docs/issues/0002-design-issues.md`, `docs/issues/0004-performance-optimizations.md`, `docs/issues/0006-ads-rewarded-implementation.md`, `docs/design-issues.html`, `docs/legal-todo.html`, `docs/memory-bank/rn-0.85-baseline.md`, and `docs/tasks.html`.
- The current pass is focused on keeping the coordination docs up to date while working through the remaining open issue-register items and verification gaps.
- 2026-05-30 pass status: still active. The ownership marker remains in place, and the open docs backlog should be treated as in progress until the next tracker refresh lands.
- 2026-05-30 continuation: this thread remains the active owner for the open docs backlog, and the current pass is still limited to coordination and blocker tracking until new evidence becomes available.
- Open items currently being carried forward include provider-auth evidence, ad/billing verification, legal/disclosure checks, and performance follow-ups.
- Progress updates should land in this file and `docs/memory-bank/activeContext.md` first so other agents can see the latest state before touching the task sources.
- 2026-05-30 refresh: no new evidence was added in this pass. The open backlog remains owned by this thread, and the next live verification steps are still gated by credentials, production-like IDs, or runner access.
- 2026-05-30 tracker refresh: the docs task index has now been regenerated from the current docs sources so the open count matches the latest issue and checklist state.
- Current continuation on 2026-05-30 is also tightening the 3D integration guidance docs so their next-step sections carry explicit owners, blockers, and not-to-parallel-edit notes before the dashboard is regenerated again.
- Current continuation on 2026-05-30 also initialized the RN 0.85 baseline template at `docs/memory-bank/rn-0.85-baseline.md`, added an ownership marker to the file itself, and left pending measurement placeholders for the remaining performance work.
- Current continuation on 2026-05-30 also added the `perf:bundle-smoke` automated bundle-size gate, verified it passes, and filled the RN baseline with measured cold/warm launch waits plus the Android Hermes bundle size (`10,726,291` bytes) and bundle-smoke export time (`42,007ms`); memory and render-jank profiling are still pending.
- Current continuation on 2026-05-30 also validated the current design-pattern source slice with `pnpm exec tsc --noEmit --pretty false` plus targeted Jest coverage for `ModalFanfareSequence`, `Keyboard`, `ModalSequenceBreadcrumb`, `FullProfileDetailsModal`, `LeaderboardModal`, `SolarSystem3D`, and `sceneFactory` (7 suites / 102 tests). The modal sequencing, keyboard persistence, profile/leaderboard layout, and solar lighting refinements are verified in code.
- Current continuation on 2026-05-30 also reconciled the docs backlog so already-evidenced slices like the loss-modal stranded-board / Next-action fix, Android loss/skip/continue/back gating, Coin Purchase UX, and full registered-modal coverage are reflected as completed in the companion trackers, while provider-auth, billing/ad, and legal evidence items remain open.
- Current continuation regenerated `docs/tasks.html` after those doc updates; the task index now reports 347 total tasks, 9 open todos, 2 blocked items, and 336 done items, which confirms the new notes did not introduce accidental task drift.
- Current continuation also added a visible work-in-progress ownership note to `docs/tasks.html` so the tracker itself carries the same ownership state as the memory-bank files.
- Current continuation also added source-level ownership notes in the open tracker sections of `docs/tasks.html` so the active issue blocks are explicitly marked as in-progress.
- Current continuation also added visible work-in-progress banners to `docs/design-issues.html` and `docs/legal-todo.html` so the broader trackers show the same ownership state as the memory-bank files.
- Completed this pass: the iOS next-steps review/owner assignment and the missing-credentials / CI-documentation items are checked off in `docs/issues/0008-ios-build-next-steps.md`, and `docs/tasks.html` was synced so the generated index now reflects that update.

---

## Current Status: Design Patterns Refactor Documented and Closed (May 2026)

- Epic branch: `refactor/design-patterns` (documented in the tracker and ADR catalog).
- Completed: PR 1–15 scope — core, ports, GameEngine, auth application layer, modal command bus/sequence, GameScreen decomposition, navigation, Game UI, and documentation polish.
- Verification: `pnpm run test:core` (16), `pnpm exec tsc --noEmit`, AuthContext (16), useGameLogic (33), ModalCommandBus (2), `ModalFanfareSequence` (2), GameScreen (115), plus the completed docs catalog and ADR updates.
- Remaining: keep the catalog current when new pattern-bearing modules appear; no open tracker PRs remain.

---

## Previous Status: Android QA Handoff (May 2026)

- Canonical current tracker: `docs/android-emulator-firebase-qa-plan.html`.
- Supporting tracker docs: `docs/design-issues.html` and `docs/responsive-todo-list.html`.
- Documentation files have been moved under `docs/`, preserving subfolders; root `readme.md` and `AGENTS.md` remain at repository root.
- RN 0.85 follow-up: `react-native` and `@react-native/jest-preset` are now on `0.85.1`, so the shared-animation backend version gate is no longer blocked by package availability. The experimental flag remains disabled by default; `react-native` is intentionally excluded from Expo dependency validation because SDK 56 canary still expects `0.85.0`. Details, Windows pnpm install recovery notes, stale-test fixes, and final verification are in `docs/rn-0.85-upgrade-playbook.md`. Final verification on 2026-05-25 passed `pnpm run test:rn -- --runInBand` (175 suites / 3614 tests), `pnpm exec tsc --noEmit --pretty false`, `pnpm run check:rn-upgrade`, and `pnpm exec expo install --check`.
- Latest full guarded Android matrix passed: `emulator-tests/logs/test-android-matrix-full-dsi034-20260525.stdout.txt` shows eight configured `rq_*` AVDs, 33 screen/modal surfaces per device, no `unexpected-stream`, no unknown `react-native` module, and no cleanup `process not found` signature.
- Latest focused layout fix: `DSI-035` is closed. `VictoryModal` / "Nice job" and `LevelUpFanfareModal` now have taller responsive decorative backgrounds, focused modal tests, TypeScript verification, and fresh all-device focused captures for `modal-victory` and `modal-level-up-fanfare`. Evidence: `emulator-tests/logs/test-android-matrix-unit-dsi035-20260525.txt`, `emulator-tests/logs/typescript-check-dsi035-20260525.txt`, and `emulator-tests/logs/test-android-matrix-dsi035-focused-20260525.txt`.
- Rewarded ads are standardized on Google AdMob / Google Mobile Ads. Current implementation notes live at `docs/google-admob-rewarded-ads-implementation.md`; stale provider-specific references were removed from docs, filenames, and generated test output on 2026-05-25. Authenticated rewarded-ad rewards now confirm through backend `awardedAdCallback` for loss continue and the existing coin-shop handler/dev/future UI entry; the client uses backend `newCoins` as source of truth while guest rewards remain local-only. The Coin Shop intentionally does not render a watch-ad action; rewarded ads are offered from the loss popup. `app.config.js` now honors documented `GOOGLE_MOBILE_ADS_*` app-ID variables before legacy `ADMOB_*` fallbacks, `.env.example` matches the docs, and local Expo public config currently resolves to Google's safe test IDs because real Mobile Ads IDs are not set locally. Focused GameScreen, Firebase callable tests, config tests, root TypeScript, Functions build, and targeted Functions lint passed after the wiring; lint initially caught an unused `HttpsError` import in `ads.test.ts`, which was removed.
- Rewarded-ad no-reward fallback and listener-cleanup source coverage was added on 2026-05-25. `GameScreen.test.tsx` now covers Coin Shop and loss-modal no-reward fallbacks; `src/services/__tests__/RewardedAdService.test.ts` covers temporary Google Mobile Ads reward/close listener cleanup across repeated shows and close-without-reward behavior; `test:android:matrix:unit` includes the new service test. Evidence: focused Jest passed 2 suites / 113 tests, TypeScript passed, and the matrix unit preflight passed 49 suites / 991 tests. Recorded issues: Jest dynamic `import()` was replaced with `require` after `A dynamic import callback was invoked without --experimental-vm-modules`, and an `rg` lookahead search was replaced with split searches plus PowerShell `Select-String`.
- Current continuation reread all 52 docs files via digest before acting (8,363 lines / 599,249 characters), confirmed Expo MCP is still unavailable through `tool_search`, and revalidated the rewarded-ad source-unit slice. Focused Jest passed 2 suites / 113 tests, root TypeScript passed with no output, and `pnpm run test:android:matrix:unit` passed 49 suites / 991 tests. Stale `docs/memory-bank/techContext.md` package versions were updated and the obsolete Metro-blocked start-command note was removed. No new source errors were found; the remaining ad work is live/off-repo verification.
- DSI-032 received fresh React Native `0.85.1` evidence on 2026-05-25 after rereading all docs: `emulator-tests/logs/metro-react-native-module-check-rn0851-20260525.txt` records Metro HTTP 200 and Android bundle HTTP 200 with 21,022,432 bytes, and `pnpm run test:android:matrix:run -- -ProbeOnly` passed host/emulator asset plus websocket probes. Focused `page-landing` failures on `rq_pixel_4a_api_36_1` were harness/emulator-state issues rather than an unknown-module recurrence. Fixes in `scripts/android-emulator-run-matrix.ps1` refuse launcher screenshots as app evidence, check foreground through focused/top-resumed `dumpsys window` plus task state, avoid hot UIAutomator polling, capture `adb shell monkey` output without `NativeCommandError`, explicitly relaunch the dev-client URL after Expo's launch marker, and retry invalid/empty ADB screenshots with transport recovery. After killing the stale AVD that was hitting startup ANR/Google Play Services attach loops, the runner cold-booted it and `emulator-tests/logs/test-android-matrix-dsi032-page-landing-freshboot-20260525.txt` passed with landing screenshot/XML evidence and no runtime `Requiring unknown module "react-native"` signature.
- Doc-hygiene follow-up on 2026-05-25 reread all 52 docs files, removed a stray patch marker from `docs/src/contexts/README.md`, and updated `docs/design-issues.html` so DSI-032 is treated as a watch item rather than an open blocker after the fresh RN 0.85.1 evidence. The canonical QA tracker records the issue/resolution notes for Expo MCP unavailability and the PowerShell range-read mistake.
- Offline trigger source coverage follow-up on 2026-05-25 reread all 52 docs files (8,371 lines / 604,256 characters), added `GameScreen.test.tsx` coverage for initial NetInfo offline reachability, live offline/online events, board overlay blocking, and listener cleanup, and rechecked the live production legal matrix. Verification passed: focused GameScreen Jest 1 suite / 113 tests, combined RewardedAdService + GameScreen Jest 2 suites / 115 tests, TypeScript, and `pnpm run test:android:matrix:unit` 49 suites / 993 tests. Live legal/support routes are still blocked: `0 / 119` passed and `119 / 119` returned 404, with evidence in `emulator-tests/logs/live-roobsworld-legal-matrix-20260525-154524.*`. Recorded command fixes: collect PowerShell `foreach` rows before piping; simplify malformed `rg` regex/quoting to a normal quoted TODO/FIXME/HACK/XXX search.
- Offline emulator replay follow-up on 2026-05-25 reread all 52 docs files (8,381 lines / 609,645 characters), confirmed Expo MCP is unavailable through `tool_search`, and completed Pixel 4a natural network-toggle evidence on the provider-auth game screen. Screenshots show the online Daily Challenge baseline, the `No Internet Connection` blocking modal after wifi/data plus airplane-mode toggle, and recovered game after reconnecting; evidence lives in `emulator-tests/images/offline-toggle-natural/20260525-164352-*.png` and `emulator-tests/logs/offline-toggle-natural/offline-toggle-natural-screenshot-20260525-164352.txt`. Recorded fixes: convert PowerShell byte-array Metro status responses before matching, switch from blocked QA-surface wait to natural provider-auth flow, and use screenshot/logcat evidence when UIAutomator hangs on animated welcome-back.
- Initialization retry/error follow-up on 2026-05-25 reread all 52 docs files (8,386 lines / 616,087 characters), confirmed Expo MCP is unavailable through `tool_search`, and completed the local-verifiable source plus QA-surface emulator slice. Verification passed: `pnpm exec jest src/navigation/__tests__/NavigationStack.test.tsx src/qa/__tests__/QASurfaceHarness.test.tsx --runInBand` (2 suites / 23 tests) and `pnpm run test:android:matrix:run -- -AvdNames rq_pixel_4a_api_36_1 -QASurfaceFilter page-initialization-error`. Evidence: `emulator-tests/images/rq_pixel_4a_api_36_1/surfaces/06-01-page-initialization-error.png`, matching XML, and logcat. Recorded fixes: rerun docs digest directly after nested PowerShell produced no useful output; feed `Select-String` file-only inputs after a broad docs glob attempted to read directories.
- Provider-auth Support follow-up on 2026-05-25 reread all 52 docs files (8,394 lines / 622,333 characters), confirmed Expo MCP is unavailable through `tool_search`, and completed the provider-auth Settings Help/Support handoff on Pixel 4a. Evidence: `emulator-tests/images/provider-auth-support/20260525-171147-04-provider-settings-open.png`, `20260525-171221-05-provider-support-mailto-handoff.png`, `emulator-tests/logs/provider-auth-support/20260525-171221-05-provider-support-mailto-handoff-logcat.txt`, `20260525-171257-07-provider-app-resume-second-back.png`, and `20260525-171358-08-provider-settings-idle-after-resume-logcat.txt`. Recorded fixes: decode PowerShell byte-array Metro status responses before matching, wait through provider-auth bootstrap after the first loading capture, and clear/recheck idle logcat after a transient Expo CLI reconnect warning during Gmail return.
- Legal audit follow-up on 2026-05-25 reread all 52 docs files (8,398 lines / 629,046 characters), confirmed Expo MCP is unavailable through `tool_search`, and completed the stale dependency-audit evidence item in `docs/legal-todo.html`. Verification passed: `pnpm audit --prod` returned `No known vulnerabilities found`. The legal checklist now records the audit result, docs digest, Expo MCP fallback, and the current live legal route 404/deployment blocker; no dependency or lockfile changes were required.
- Docs task-list follow-up on 2026-05-27 tightened `docs/tasks.html` generation so historical status prose no longer appears as fake tasks. Funding docs are now completed readiness/status artifacts, iOS/store-console/video/beta-submission work is explicitly owner- or tooling-blocked, and the live legal deploy blocker was rechecked. `E:\portfolio` passed `pnpm run build`, while `pnpm dlx vercel@latest deploy --prod --yes` failed because the Vercel team/account is suspended pending a valid payment method. Expo MCP was unavailable through `tool_search`.
- Do not close or remove remaining functionality checks without evidence. Provider-auth Firebase snapshots/deltas, account deletion cleanup, billing/ad production behavior, email/password and non-Google provider flows, provider-auth About/Legal/localized legal checks, legal production/disclosure checks, and other persona/backend TODOs remain open.

---

## Current Status: Achievement System Implemented (March 2026)

### Test Results

- **RN tests**: 2,119 passing, 0 failing (100 suites)
- **Firebase Functions tests**: 386+ passing (gameLogic.test.ts: 32 tests including 11 skipRiddle tests; 61.65% coverage, 11 files at 100%)
- **Total**: 2,505+ tests, 0 failures
- **Pre-commit hook**: Fully functional — commits blocked on test failure

### Coverage Improvements (March 2026)

| File                       | Before | After      | Notes                                       |
| -------------------------- | ------ | ---------- | ------------------------------------------- |
| dailyChallenge.ts          | 56.77% | **100%**   | +20 tests, all functions covered            |
| firestoreService.ts        | 61.87% | **100%**   | +26 tests, partial progress merge edge case |
| Overall Firebase Functions | 56.24% | **61.65%** | +45 tests                                   |

### Bug Fixes (March 2026)

| Bug                                      | File                               | Fix                                                                    |
| ---------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| `gamesPlayed` incrementing per guess     | submitGuessLogic.ts                | Now only increments when `gameOver = true`                             |
| `winRate` inflated by per-guess counting | submitGuessLogic.ts                | Fixed by correcting `newGamesPlayed` calculation                       |
| No hint usage tracking                   | gameLogic.ts + firestoreSchemas.ts | Added `totalHintsUsed` to stats; `getHint` now calls `updateUserStats` |

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
- **Game timing**: `src/constants/game.ts` extended with SOUND*RESUME_DELAY_MS, WIN*\_ and LOSS\_\_ duration/delay constants. GameScreen and useSettings use these for sound and win/loss animation timing (no magic numbers).
- **Backend constants**: `firebase-functions/src/constants.ts` added with HINT*COST_COINS, SKIP_COST*\*; gameLogic getHint/skipRiddle use them. profile.ts migrated from console to Firebase logger; profile tests assert on logger mock.

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

| File                    | Current    | Target  | Notes                                                                                                                                                                                         |
| ----------------------- | ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| riddleGeneration.ts     | **91.71%** | 70%+ ✅ | +tests: tutorial (generateAndAppend, getNextIndex, store), daily/tutorial store errors, generateTodaysDailyChallenge + callable, getNextDailyIndex error; FieldValue mock for daily challenge |
| submitGuessLogic.ts     | 94.65%     | ~95%    | Remaining lines are dead code                                                                                                                                                                 |
| iapConfig.ts            | 97.82%     | ~98%    | Lines 185-186 structurally unreachable                                                                                                                                                        |
| iapPlatformValidator.ts | 97.72%     | ~98%    | Line 141 is dead code                                                                                                                                                                         |
| firestoreService.ts     | **100%**   | ✅ Done | Added test for partial progress merge (lines 338–347)                                                                                                                                         |

---

## Known Issues (Minor)

1. Resolved: Facebook login test refinement — added edge case "should proceed with sign-in when LoginManager.logOut throws during session clear" (March 2026).
2. Resolved: Console warning cleanup — jest.setup.js suppresses console.log/warn during tests; AuthService test teardown fixed (onAuthStateChanged sync mock, timing mock, no more "access after torn down") (March 2026).
3. Resolved: PulsingSpinner mock now uses accessibilityLabel="Loading" and accessibilityRole="progressbar"; tests assert on these (March 2026).

## Lint (March 2026)

- **Pre-commit**: Lint + RN tests + Firebase Functions tests all pass (25 lint errors fixed).
- Fixes applied: clear-cache.js global window; unused imports/vars (firestoreService.test, migrationScript.test, SettingsIcon, SoundManager, audioOptimization); mock displayName in 4 modal tests; StarryBackground star generation moved to useState lazy init; PulsingSpinner animValues changed from useRef to useState for refs-during-render rule.

---

## Completed TODOs

### Medium Priority (All Done — March 2026)

- Terms & Privacy Policy navigation (external URLs via Linking API)
- Admin authorization check (custom claims + Firestore fallback)
- IAP Product ID configuration and environment variables
- Ad client callback correlation (full S2S)
- validatePurchase placeholder removed
- Console.log cleanup — all production files use logger
- Test coverage improved to 61.65%
- All 2,497 tests passing
- User statistics accuracy (gamesPlayed bug fixed)
- Hint tracking implemented (totalHintsUsed stat)

---

## Milestone History

| Date     | Milestone                                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Mar 2026 | Performance: useCallback(processGuess), AuthContext/GameScreen memoization, Firestore riddle session cache, GameScreen React.memo |
| Mar 2026 | Tutorial flow first slice: tutorial mode in AuthContext/NavigationStack, WelcomeModal Start Tutorial, 2,497 tests passing         |
| Mar 2026 | All memory bank tasks completed; 2,497 tests, 0 failures; 10 files at 100% coverage                                               |
| Mar 2026 | All 2,111 RN tests fixed (jest.config.js preset, TurboModule mocks, 22 suites fixed)                                              |
| Mar 2025 | Expo SDK 55 upgrade (expo-av → expo-audio, New Architecture mandatory)                                                            |
| Mar 2025 | Logger infrastructure (`src/utils/logger.ts`) preventing JSI crashes                                                              |
| Jan 2025 | Major package update (RN 0.83.1, React 19, Firebase v23, Jest 30)                                                                 |
| Jan 2025 | Firebase v22→v23 modular API migration (16+ files, 50+ function calls)                                                            |
| —        | 3D solar system upgraded to 11 individual GLB models                                                                              |
| —        | Modal architecture reorganized (game/, settings/, help/ categories)                                                               |
| —        | Hint functionality wired to bottom navigation bar                                                                                 |
| —        | Critical JSI crash bug fixed (SoundManager status callback removed)                                                               |
| —        | Test coverage milestone: 52.48% → 62.27% (+275 tests)                                                                             |
