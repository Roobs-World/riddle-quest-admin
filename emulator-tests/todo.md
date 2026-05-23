# Emulator QA Todo

## Run Metadata
- Date: 2026-05-23
- Tester/agent: Codex
- Workspace: E:\qwordly
- Firebase project: qwordly-6ba44
- Mode: Live Firebase verification with disposable non-guest account for backend writes
- Tooling note: Android Studio MCP was requested, but no Android Studio MCP tool is exposed in this session. Using Android SDK, emulator, and adb CLI fallbacks.
- Status key: TODO, IN_PROGRESS, PASS, FAIL, BLOCKED, SKIPPED, UNREACHABLE

## Environment Setup
- PASS: Inventory Android SDK, emulator, platform tools, command-line tools, and existing AVDs.
- PASS: Required SDK packages are present: platform-tools 37.0.0, emulator 36.5.11, platforms android-36/android-36.1, build-tools 36.0.0/36.1.0, system-images android-36.1 google_apis_playstore x86_64.
- PASS: Created missing AVDs for the comprehensive device matrix.
- IN_PROGRESS: Boot and verify each emulator with adb.

## Device Matrix
- PASS: Small phone, Pixel 4a-class AVD created and boot-verified as `rq_pixel_4a_api_36_1`; setup screenshot `emulator-tests/images/rq_pixel_4a_api_36_1/00-boot-home.png`; setup log `emulator-tests/logs/rq_pixel_4a_api_36_1/00-boot-logcat.txt`.
- PASS: Standard phone, Pixel 7-class AVD created as `rq_pixel_7_api_36_1`; screenshot dir `emulator-tests/images/rq_pixel_7_api_36_1`; log dir `emulator-tests/logs/rq_pixel_7_api_36_1`.
- PASS: Large phone, Pixel 8 Pro-class AVD created as `rq_pixel_8_pro_api_36_1`; screenshot dir `emulator-tests/images/rq_pixel_8_pro_api_36_1`; log dir `emulator-tests/logs/rq_pixel_8_pro_api_36_1`.
- PASS: Foldable outer display AVD created as `rq_pixel_fold_outer_api_36_1`; screenshot dir `emulator-tests/images/rq_pixel_fold_outer_api_36_1`; log dir `emulator-tests/logs/rq_pixel_fold_outer_api_36_1`.
- PASS: Foldable unfolded/tablet display AVD created as `rq_pixel_fold_unfolded_api_36_1`; screenshot dir `emulator-tests/images/rq_pixel_fold_unfolded_api_36_1`; log dir `emulator-tests/logs/rq_pixel_fold_unfolded_api_36_1`.
- PASS: Small tablet, 7-8 inch AVD created as `rq_small_tablet_api_36_1`; screenshot dir `emulator-tests/images/rq_small_tablet_api_36_1`; log dir `emulator-tests/logs/rq_small_tablet_api_36_1`.
- PASS: Large tablet, 10-11 inch AVD created as `rq_large_tablet_api_36_1`; screenshot dir `emulator-tests/images/rq_large_tablet_api_36_1`; log dir `emulator-tests/logs/rq_large_tablet_api_36_1`.
- PASS: Low-density tablet AVD created as `rq_low_density_tablet_api_36_1`; screenshot dir `emulator-tests/images/rq_low_density_tablet_api_36_1`; log dir `emulator-tests/logs/rq_low_density_tablet_api_36_1`.

## Page Coverage
- TODO: Initial loading/auth spinner.
- TODO: Landing screen.
- TODO: Login screen.
- TODO: Sign Up screen if reachable.
- TODO: Riddle loading state.
- TODO: Initialization retry/error state when triggerable.
- TODO: Offline blocking state when triggerable.

## Modal Coverage
- TODO: welcome
- TODO: welcomeBack
- TODO: instructions
- TODO: info
- TODO: hint
- TODO: skip
- TODO: victory
- TODO: loss
- TODO: coinShop
- TODO: coinPurchaseFanfare
- TODO: achievementUnlockFanfare
- TODO: streakIncreaseFanfare
- TODO: levelUpFanfare
- TODO: settings
- TODO: fullProfileDetails
- TODO: upgradeAccount
- TODO: updateUsername
- TODO: achievements
- TODO: stats
- TODO: leaderboard
- TODO: credits
- TODO: aboutLegal

## Functionality Coverage
- TODO: Guest entry for UI-only guest behavior.
- TODO: Disposable non-guest auth for live Firebase write verification.
- TODO: Email/password login if available.
- TODO: Signup if reachable.
- TODO: Logout.
- TODO: Upgrade account.
- TODO: Daily Challenge.
- TODO: Classic mode.
- TODO: Daily fallback to Classic.
- TODO: Correct win.
- TODO: Incorrect guess feedback.
- TODO: Duplicate-letter feedback where possible.
- TODO: Loss and continue paths.
- TODO: Next level.
- TODO: Skip.
- TODO: Hint.
- TODO: Insufficient coins.
- TODO: Keyboard input, backspace, slot tapping, submit disabled/enabled.
- TODO: Coin display and animation.
- TODO: Profile, settings, mute, sound/haptics, language selector.
- TODO: Support email, credits, about/legal.
- TODO: Stats, achievements, leaderboard tabs.
- TODO: Coin shop states and actions.
- TODO: App restart persistence and profile refresh.

## Firebase Snapshots
- TODO: Capture before snapshot for disposable non-guest QA account.
- TODO: Capture after snapshots for Classic win, Daily win if available, hint, skip, continue, loss, and achievements.

## Issues And Blockers
- INFO: Android Studio MCP requested but unavailable in active tools. Continuing with SDK/ADB fallback unless a matching MCP tool becomes available.
- INFO: Existing AVDs before setup: Medium_Phone_API_36.1 and Medium_Tablet.

## Skipped Or Unreachable
- TODO: Fill as testing progresses.

## Handoff Notes
- IN_PROGRESS: Emulator setup started by inventorying local SDK and existing AVDs.
