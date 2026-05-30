# Active Context - Riddle Quest Development

## Current Work Focus: Docs Task Continuation (May 2026)

- Canonical coordination file: `docs/tasks.html`.
- Work-in-progress ownership marker: the current Codex thread is actively working the open docs backlog pass, the generated task index, and the issue docs listed below. These files remain open for coordination; sync before parallel edits so progress notes stay consistent.
- Current ownership note: Codex is actively working the open docs task slice and updating progress in the memory-bank files as it goes.
- 2026-05-30 pass status: still active. No new evidence was added in this response, and the ownership marker remains in force while the tracker and issue docs stay in sync.
- 2026-05-30 tracker refresh: the docs task index has been regenerated from the current markdown/HTML sources after the latest ownership notes, and the progress pass is now explicitly carrying the remaining open verification work forward rather than leaving stale task counts behind.
- 2026-05-30 continuation: current Codex thread remains the owner for the open docs backlog pass. The ownership marker stays in force for the issue docs, tracker, and baseline file until the next evidence refresh lands.
- 2026-05-30 refresh: no new evidence was added in this pass, but the RN 0.85 baseline template was initialized for the remaining performance work and the generated task index now carries source-level ownership notes. The backlog remains owned by this thread until the next tracker refresh lands.
- 2026-05-30 performance follow-up: a bundle-size smoke gate was added (`pnpm run perf:bundle-smoke`), the smoke passed, and the RN baseline now records measured cold/warm launch waits plus Android Hermes bundle size (`10,726,291` bytes) and bundle-smoke export time (`42,007ms`). Memory and render-jank profiling remain open.
- 2026-05-30 source verification follow-up: the current design-pattern source slice was validated with `pnpm exec tsc --noEmit --pretty false` plus targeted Jest coverage for `ModalFanfareSequence`, `Keyboard`, `ModalSequenceBreadcrumb`, `FullProfileDetailsModal`, `LeaderboardModal`, `SolarSystem3D`, and `sceneFactory` (7 suites / 102 tests). The modal sequencing, keyboard persistence, profile/leaderboard layout, and solar lighting refinements are now verified in code.
- 2026-05-30 baseline maintenance: `scripts/baseline-report.js` now preserves measured RN 0.85 baseline values, pending profiling items, and notes when refreshing environment/runtime metadata.
- 2026-05-30 3D texture follow-up: `SolarSystem3D` now renders configured textured rings using cached Three.js ring geometry/materials, and `SolarSystemConfig` imports the existing `assets/3d` ring textures directly. Verification passed with focused solar Jest coverage (3 suites / 16 tests) and root TypeScript.
- Open docs tasks currently tracked for continued evidence gathering and closure:
  - `docs/issues/0001-android-emulator-firebase-qa-plan.md`
  - `docs/issues/0002-design-issues.md`
  - `docs/issues/0004-performance-optimizations.md`
  - `docs/issues/0006-ads-rewarded-implementation.md`
  - `docs/memory-bank/rn-0.85-baseline.md`
  - `docs/design-issues.html`
  - `docs/legal-todo.html`
- Additional guide docs currently being updated in the same pass:
  - `docs/google-admob-rewarded-ads-implementation.md`
  - `docs/performance-optimizations-todo.md`
  - `docs/design-issues.html`
  - `docs/legal-todo.html`
- Current pass note: no new emulator, ad, or iOS build evidence was added in this run; the remaining work is still environmental or credential-blocked until the next live verification opportunity.
- Current pass note: the perf tracker slice is complete and now serves as the recorded baseline; remaining open work is concentrated in provider-auth, billing/ad, and legal verification.
- Working rule: keep the coordination docs current first, then update the relevant issue or tracker file with the newest evidence, blocker state, or verification result.
- Current task-state rule: treat the open docs backlog as in progress until the tracker refresh is regenerated and the issue docs are explicitly marked otherwise; use ownership markers rather than locks.
- Progress this pass: the iOS next-steps review, CI follow-up, and missing-credentials documentation are now complete in `docs/issues/0008-ios-build-next-steps.md`, `docs/IOS_BUILD_GUIDE.md`, and `docs/integration-guide.md`; no iOS checklist items remain open in that issue doc.
- Progress this pass: the RN 0.85 baseline template has been initialized at `docs/memory-bank/rn-0.85-baseline.md`, and the file now carries its own ownership marker plus pending measurement placeholders.
- Progress this pass: the loss-modal stranded-board / Next-action design defect, Android loss/skip/continue/back gating, Coin Purchase UX surface, and full registered-modal coverage are already evidenced in the companion trackers. Those completed slices are being reflected back into the source docs while the provider-auth, billing, ad, and legal verification items remain open.

---

## Current Work Focus: Design Patterns Refactor (May 2026)

### Docs Backlog Workstream Coordination

- Active agent: current Codex thread is updating the open docs backlog and generated task index.
- Files currently being edited: `docs/issues/0001-android-emulator-firebase-qa-plan.md`, `docs/issues/0002-design-issues.md`, `docs/issues/0004-performance-optimizations.md`, `docs/issues/0006-ads-rewarded-implementation.md`, `docs/performance-optimizations-todo.md`, `docs/google-admob-rewarded-ads-implementation.md`, `docs/design-issues.html`, `docs/legal-todo.html`, `docs/memory-bank/rn-0.85-baseline.md`, and `docs/tasks.html`.
- These files remain open for coordination. Sync before parallel edits while this thread is in progress to prevent conflicting docs state.
- Last refresh: 2026-05-30. The generated docs task index was regenerated from source docs after the latest ownership pass and now reflects the RN 0.85 baseline checkpoint.

### Design patterns epic (branch `refactor/design-patterns`)

- Tracker: `docs/design-patterns-refactor-plan.html` (closed, all 15 PRs checked).
- Canonical pattern catalog: `docs/adr/0002-pattern-catalog-and-documentation-contract.md`.
- Documented pattern modules:
  - `AuthSessionFacade`, `PlayerRepository`, `RiddleSessionService`, and `useAuthProviderController`.
  - `ModalCommandBus` and `ModalFanfareSequence`.
  - `AnalyticsService` and `GameEventBus`.
- Current focus: keep the catalog and module docs synchronized whenever a new pattern-bearing surface lands.

---

## Previous Focus: Android QA Handoff (May 2026)

### Latest Handoff For Next Agent

- The canonical progress tracker is `docs/android-emulator-firebase-qa-plan.html`. Keep that file updated first, then mirror short status changes into `docs/design-issues.html` and `docs/responsive-todo-list.html`.
- Documentation files have been moved under `docs/`, preserving subfolders. Root `readme.md` and `AGENTS.md` remain in the repository root. Hidden agent/tooling docs and generated coverage HTML intentionally remain in place.
- RN 0.85 upgrade follow-up: `react-native` and `@react-native/jest-preset` are now on `0.85.1`, unblocking the shared-animation backend version gate while leaving `EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND` disabled by default. `react-native` is intentionally listed in `expo.install.exclude` because Expo SDK 56 canary validation still expects `0.85.0`; progress, install errors, stale-test fixes, and recovery notes are recorded in `docs/rn-0.85-upgrade-playbook.md`. Final verification on 2026-05-25 passed `pnpm run test:rn -- --runInBand` (175 suites / 3614 tests), `pnpm exec tsc --noEmit --pretty false`, `pnpm run check:rn-upgrade`, and `pnpm exec expo install --check`.
- Latest guarded Android matrix evidence: `emulator-tests/logs/test-android-matrix-full-dsi034-20260525.stdout.txt` passed on all eight configured `rq_*` AVDs, captured 33 screen/modal surfaces per device, and had no `unexpected-stream`, unknown `react-native` module, or cleanup `process not found` signature.
- Latest focused layout fix: `DSI-035` is closed. `VictoryModal` / "Nice job" and `LevelUpFanfareModal` now use taller responsive decorative backgrounds; `VictoryModal` keeps its extra bottom spacing inside padding. Evidence: `emulator-tests/logs/test-android-matrix-unit-dsi035-20260525.txt` passed 48 suites / 984 tests, `emulator-tests/logs/typescript-check-dsi035-20260525.txt` passed with no output, and `emulator-tests/logs/test-android-matrix-dsi035-focused-20260525.txt` captured `modal-victory` and `modal-level-up-fanfare` on all eight configured `rq_*` AVDs with zero WARN/FAIL lines.
- Rewarded ads currently use Google AdMob / Google Mobile Ads only. The current implementation note is `docs/google-admob-rewarded-ads-implementation.md`; stale provider-specific references were removed from docs, filenames, and generated test output on 2026-05-25. Authenticated rewarded-ad rewards now confirm through the backend `awardedAdCallback` for visible `loss_continue` rewards and the existing `coin_shop` handler/dev/future UI entry, then update local coins from backend `newCoins` with `syncToFirestore: false`; guest rewarded-ad rewards remain local-only. The current Coin Shop UI intentionally does not render a watch-ad action; rewarded ads are presented from the loss popup. `app.config.js` now reads the documented `GOOGLE_MOBILE_ADS_*` app-ID variables first, falls back to legacy `ADMOB_*`, and then Google's safe test app IDs.
- Latest rewarded-ad source/config verification: `pnpm exec jest src/screens/game/__tests__/GameScreen.test.tsx --runInBand` passed 109 tests, `pnpm --dir firebase-functions test -- src/__tests__/ads.test.ts src/__tests__/index.test.ts src/__tests__/constants.test.ts --runInBand` passed 22 tests, `pnpm exec jest src/config/__tests__/appConfig.test.js --runInBand` passed 3 tests, `pnpm exec tsc --noEmit --pretty false` passed, `pnpm --dir firebase-functions build` passed, and `pnpm --dir firebase-functions lint -- src/ads.ts src/__tests__/ads.test.ts` passed after removing an unused `HttpsError` import from `ads.test.ts`. Redacted `pnpm exec expo config --type public --json` verification shows the current local environment resolves Android/iOS Mobile Ads app IDs to Google's safe test IDs because real IDs are not set locally. PowerShell `foreach` piping errors were resolved by collecting rows before piping; an exploratory Windows `rg` glob error was resolved with explicit path searches.
- Latest rewarded-ad fallback/listener verification: source-unit coverage now verifies Coin Shop and loss-modal no-reward fallbacks, confirms temporary Google Mobile Ads reward/close listeners are removed across repeated shows, and adds `src/services/__tests__/RewardedAdService.test.ts` to `pnpm run test:android:matrix:unit`. Evidence: `pnpm exec jest src/services/__tests__/RewardedAdService.test.ts src/screens/game/__tests__/GameScreen.test.tsx --runInBand` passed 2 suites / 113 tests, `pnpm exec tsc --noEmit --pretty false` passed, and `pnpm run test:android:matrix:unit` passed 49 suites / 991 tests. A Jest dynamic `import()` helper error was resolved by switching to the repo's `require` pattern after `jest.doMock`; an `rg` unchecked-checkbox lookahead error was resolved by splitting the search and using PowerShell `Select-String` for HTML.
- Current continuation rechecked the docs and rewarded-ad source-unit slice: all 52 docs files were reread via digest (8,363 lines / 599,249 characters), Expo MCP remained unavailable through `tool_search`, focused rewarded-ad Jest passed 2 suites / 113 tests, TypeScript passed with no output, and `pnpm run test:android:matrix:unit` passed 49 suites / 991 tests. Also updated stale `docs/memory-bank/techContext.md` package versions and removed the obsolete Metro-blocked start-command note after confirming current Jest, pnpm, and Expo CLI versions. No new source errors were found; remaining rewarded-ad work is live/off-repo proof.
- Latest DSI-032 follow-up: all 52 docs files were reread before continuing. Fresh React Native `0.85.1` Metro/bundle evidence is in `emulator-tests/logs/metro-react-native-module-check-rn0851-20260525.txt` (Metro HTTP 200, Android bundle HTTP 200, 21,022,432 bytes), and `pnpm run test:android:matrix:run -- -ProbeOnly` passed host/emulator asset and websocket probes. Focused `page-landing` failures exposed harness and stale-emulator state problems, not a `Requiring unknown module "react-native"` recurrence. Runner hardening in `scripts/android-emulator-run-matrix.ps1` now uses focused/top-resumed `dumpsys window` foreground checks, avoids hot UIAutomator foreground polling, refuses launcher screenshots as app evidence, captures `adb shell monkey` output without PowerShell `NativeCommandError`, retries invalid/empty ADB screenshots with transport recovery, and explicitly relaunches the dev-client URL after Expo's launch marker if needed. The stale AVD was killed after startup ANRs and Google Play Services attach loops; the runner cold-booted it and `emulator-tests/logs/test-android-matrix-dsi032-page-landing-freshboot-20260525.txt` passed with `qa-surface:page-landing`, `Play as Guest`, and `Made by Roobs World` evidence.
- Latest doc-hygiene continuation: current agent reread all 52 docs files (8,376 lines / 598,187 characters), removed a stray `*** End Patch` marker from `docs/src/contexts/README.md`, and reconciled `docs/design-issues.html` so DSI-032 is a watch item rather than an open blocker after the fresh evidence above. New agent-learning notes are appended in `docs/android-emulator-firebase-qa-plan.html`; Expo MCP was still unavailable through `tool_search`, and a PowerShell `Select-Object -Index 250..390` range read was replaced with `-Skip` / `-First`.
- Latest offline/legal continuation: current agent reread all 52 docs files (8,371 lines / 604,256 characters), added source-level `GameScreen` coverage for natural NetInfo offline triggers, online recovery, board overlay blocking, and listener cleanup, and reran the live production legal matrix. Verification passed: `pnpm exec jest src/screens/game/__tests__/GameScreen.test.tsx --runInBand` (1 suite / 113 tests), `pnpm exec jest src/services/__tests__/RewardedAdService.test.ts src/screens/game/__tests__/GameScreen.test.tsx --runInBand` (2 suites / 115 tests), `pnpm exec tsc --noEmit --pretty false`, and `pnpm run test:android:matrix:unit` (49 suites / 993 tests). Live `www.roobsworld.com` legal/support routes remain blocked: `0 / 119` passed and `119 / 119` returned 404; evidence lives in `emulator-tests/logs/live-roobsworld-legal-matrix-20260525-154524.*`. Command issues resolved this pass: PowerShell `foreach` piping must collect rows first, and malformed `rg` regex/quoting was replaced with a simpler quoted TODO/FIXME/HACK/XXX search.
- Latest offline emulator follow-up: current agent reread all 52 docs files (8,381 lines / 609,645 characters), confirmed Expo MCP is unavailable through `tool_search`, and completed the natural Pixel 4a offline blocking/recovery replay on the provider-auth game screen. Evidence: `emulator-tests/images/offline-toggle-natural/20260525-164352-02-online-game-ready.png`, `20260525-164352-03-offline-blocking-visible.png`, `20260525-164352-04-online-recovered-game.png`, and `emulator-tests/logs/offline-toggle-natural/offline-toggle-natural-screenshot-20260525-164352.txt`. Issues resolved: convert PowerShell `Invoke-WebRequest` byte-array status responses before matching Metro status; cached provider-auth welcome-back can block QA-surface waits, so use a natural launch and dismiss it for this replay; UIAutomator can hang on animated welcome-back, so screenshot/logcat evidence is authoritative for this transient flow.
- Latest initialization-error follow-up: current agent reread all 52 docs files (8,386 lines / 616,087 characters), confirmed Expo MCP remains unavailable through `tool_search`, and completed the local-verifiable initialization retry/error slice. Verification passed: `pnpm exec jest src/navigation/__tests__/NavigationStack.test.tsx src/qa/__tests__/QASurfaceHarness.test.tsx --runInBand` (2 suites / 23 tests) and `pnpm run test:android:matrix:run -- -AvdNames rq_pixel_4a_api_36_1 -QASurfaceFilter page-initialization-error`. Evidence: `emulator-tests/images/rq_pixel_4a_api_36_1/surfaces/06-01-page-initialization-error.png`, matching XML, and logcat. Issues resolved: reran the docs digest directly after a nested PowerShell form emitted no useful output, and changed broad docs scanning to file-only input after `Select-String -Path docs\**\*` tried to read directories.
- Latest provider-auth Support follow-up: current agent reread all 52 docs files (8,394 lines / 622,333 characters), confirmed Expo MCP remains unavailable through `tool_search`, and completed the provider-auth Settings Help/Support handoff on `rq_pixel_4a_api_36_1`. Evidence: `emulator-tests/images/provider-auth-support/20260525-171147-04-provider-settings-open.png`, `20260525-171221-05-provider-support-mailto-handoff.png`, `emulator-tests/logs/provider-auth-support/20260525-171221-05-provider-support-mailto-handoff-logcat.txt`, `20260525-171257-07-provider-app-resume-second-back.png`, and `20260525-171358-08-provider-settings-idle-after-resume-logcat.txt`. Recorded fixes: decode PowerShell byte-array Metro status responses before matching, wait through provider-auth bootstrap instead of treating the first loading spinner capture as failure, and clear/recheck idle logcat after a transient Expo CLI reconnect warning appeared while returning from Gmail.
- Latest legal audit follow-up: current agent reread all 52 docs files before acting (8,398 lines / 629,046 characters), confirmed Expo MCP remains unavailable through `tool_search`, and completed the stale `docs/legal-todo.html` dependency-audit evidence item. `pnpm audit --prod` passed with `No known vulnerabilities found`; `docs/legal-todo.html` now records the 2026-05-25 result, the docs digest, the Expo MCP fallback, and the current live legal route 404/deployment blocker. No dependency or lockfile changes were required.
- Latest docs task-list follow-up on 2026-05-27: `docs/tasks.html` generation now ignores historical status prose and only includes structured checklist / issue-register task rows. Funding checklists were closed as readiness/status artifacts with owner-controlled blockers recorded. Expo MCP was unavailable through `tool_search`. The related `E:\portfolio` legal site built with `pnpm run build`, but `pnpm dlx vercel@latest deploy --prod --yes` still failed because the Vercel team/account is suspended pending a valid payment method.
- Next agent should continue only evidence-backed functional/persona/backend TODOs. Keep open provider-auth Firebase snapshots/deltas, backend proof, production billing/ad behavior, email/password and non-Google provider flows, provider-auth About/Legal/localized legal checks, account deletion cleanup, and legal production/disclosure comparisons until individually verified.
- Keep all remaining functional TODOs open until evidenced. Do not remove checks just because the latest surface matrix passed; provider-auth Firebase snapshots/deltas, backend proof, production billing/ad behavior, email/password and non-Google provider flows, provider-auth About/Legal/localized legal checks, account deletion cleanup, and legal production/disclosure comparisons remain separate open verification work.
- Provider-auth test email is `craigbeswetherick@gmail.com`; the agent may type that email exactly and pause for the user to enter password/2FA. Never record the password.

---

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
- **Firestore mock fix**: `firestoreService.test.ts` — `admin.firestore.FieldValue.arrayUnion` was undefined because the mock exposed `FieldValue` on the firestore _instance_ instead of on the `firestore` function. Fixed by using `Object.assign(() => mockFirestore, { FieldValue: { arrayUnion: (...args) => args } })` as the firestore export so `appendUnlockedAchievements` tests pass. Full pre-commit (lint + RN + Functions) passes.

---

## Previous Focus: Documentation Coverage & Standards (March 2026)

### Documentation Pass Completed ✅

- **Standards**: Added a “Code Documentation Standards” section to `docs/memory-bank/systemPatterns.md`, defining TSDoc expectations, `@fileoverview` usage, and when to add folder-level READMEs.
- **Hooks**: Documented `useGameLogic`, `useModal`, `useSettings`, and `useFirstTimeExperience` with file overviews and TSDoc describing inputs, outputs, and side effects.
- **Contexts & Navigation**: Added file-level overviews and hook docs for `AuthContext`/`useAuth` and `NavigationStack`, clarifying their orchestration roles.
- **Services**: Topped up documentation for `GameStateManager`, `AudioFeedbackManager`, `SolarSystemPreloader`, and `TextureDebugger`, and added `docs/src/services/README.md` describing service responsibilities.
- **Components & Screens**: Ensured key game UI components and auth screens (`Header`, `GuessGrid`, `Keyboard`, `BottomNavigationBar`, `CoinsDisplay`, `LandingScreen`, `LoginScreen`, `SignUpScreen`, `ForgotPasswordScreen`, `GameScreen`) have clear file overviews and/or TSDoc summaries.
- **Firebase Functions**: Added an entrypoint-level `@fileoverview` in `firebase-functions/src/index.ts` explaining how Cloud Functions are exported from feature modules.
- **Folder READMEs**: Added concise `README.md` files under `docs/src/hooks/`, `docs/src/contexts/`, and `docs/src/services/` to document how these layers are intended to be used together.

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
import {COLORS, SPACING, BORDER_RADIUS, SHADOWS} from "../styles";
```

### Firebase Modular API (Post-Migration)

```typescript
import {getFirestore} from "@react-native-firebase/firestore";
import {getApp} from "@react-native-firebase/app";
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
