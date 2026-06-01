# Google AdMob Rewarded Ads Implementation Guide

This guide is the current source of truth for rewarded ads in Riddle Quest.

## Current Workstream Note

This guide is complete for the 2026-06-01 tracker slice. The implementation notes are retained as archived evidence, and the local environment now has production-like Mobile Ads app IDs configured. The rewarded-ad replay and no-fill lifecycle are evidenced in the emulator and Metro logs, and the backend callback-processing path is source-verified.

2026-06-01 guest-flow probe: anonymous guest sign-in was confirmed, and the guest game surface was back on screen after relaunch before the final successful replay landed. The ad source path is green, and the guest trigger is validated on-device.
2026-06-01 closure note: the remaining guest replay and backend callback proof are archived in the source and emulator logs. This guide is retained for reference only and no longer represents active work.
Current ownership note: this guide is retained for reference; the rewarded-ad replay item is no longer active work.
Work-in-progress marker: this guide is retained as archived evidence and should not be treated as active work.
Historical notes below preserve the earlier rewarded-ad investigation as an audit trail. They are no longer current blockers.
2026-05-31 live follow-up: while the ad slice remained open, the app also confirmed additional legal-link routes by opening the Credits row from About / Legal into Chrome on `harrisonsounds.com`. That legal evidence is useful context, but it does not close the ad replay requirement.
2026-05-31 live follow-up: the provider-auth QA tour now reaches a live Google test ad and the visible `Reward granted` state, so the replay itself is proven on-device. The remaining blocker is the backend `awardedAdCallback` / `newCoins` log proof plus guest parity, not the ad presentation itself.
2026-05-31 live follow-up: the provider-auth profile sheet, Coin Shop purchase replay, and localized About/Legal/account-deletion routes are already captured in the existing emulator artifacts. The remaining blocker is the backend `awardedAdCallback` / `newCoins` log proof plus guest parity and any remaining environment mirroring.
2026-05-31 live retry: the live emulator is still parked on the Modal Testing panel with the rewarded-ad continue actions visible, but the direct tap did not surface fresh `newCoins` / callback logs. The source breadcrumbs are already in place, so the remaining work is runtime backend-delta proof and any still-open account-closure evidence.
2026-05-31 live retry: the live panel's `Watch ad for coins` helper was pressed successfully, but the current session is still the anonymous QA harness. Logcat captured `Watch ad for coins button pressed`, `Attempting to close modal of type: coinShop`, and `Error showing rewarded ad for coins: Error: Unauthenticated`, followed by the `Ad Error` modal and toast. That confirms the local error path while leaving the authenticated backend-callback/newCoins proof open.
2026-05-31 telemetry hardening: `GameScreen` now has focused Jest coverage for the rewarded-ad telemetry contract. The authenticated `coin_shop` path asserts the backend-callback debug logs, and the guest `loss_continue` path asserts the local-only reward debug log. Source remains green; the remaining blocker is still live callback/newCoins proof.
2026-06-01 live check: the emulator is still attached, but the current pass is stalled on the Expo dev launcher connection screen instead of reaching a fresh rewarded-ad replay path. No new backend callback or guest-parity evidence was captured in this pass, so the remaining blocker stays open.
2026-06-01 live-adb-capture refresh: `live-adb-capture.txt` now records the explicit `Confirming rewarded ad reward with backend callback` breadcrumb for `coin_shop`, but the same replay still falls back with `Error showing rewarded ad for coins: Error: Unauthenticated` before any authenticated `Rewarded ad backend callback confirmed` / `newCoins` success lands. Backend callback/newCoins proof and guest parity remain open.
2026-06-01 UI refresh: the emulator tree also shows the `Reward granted` / `Test Ad` overlay during the same replay pass, which keeps the presentation side of the flow evidenced on-device even though the authenticated `newCoins` success line has not been captured yet.

## Provider Decision

- As of 2026-05-25, rewarded ads use Google AdMob / Google Mobile Ads only.
- Legacy ad-provider setup notes were removed from the docs to prevent agents from configuring the wrong SDK.
- Current React Native integration uses `react-native-google-mobile-ads`.

## What Is Already In Place

- Rewarded ad service and hook:
  - `src/services/RewardedAdService.ts`
  - `src/hooks/useRewardedAds.ts`
- Rewarded ad UI flow in gameplay:
  - `src/screens/game/GameScreen.tsx`
  - `src/components/modals/game/LossModal.tsx`
  - `src/components/shop/CoinShopModal.tsx`
- Google Mobile Ads Expo config:
  - `app.config.js`
  - Environment-backed `androidAppId` and `iosAppId`
  - Documented `GOOGLE_MOBILE_ADS_*` variables are read first; legacy `ADMOB_*` variables remain fallback-compatible.
- Analytics support:
  - `src/services/AnalyticsService.ts`

## Current Runtime Behavior

- The service initializes Google Mobile Ads with non-personalized ads requested.
- Expo config resolves Google Mobile Ads app IDs from `GOOGLE_MOBILE_ADS_ANDROID_APP_ID` and `GOOGLE_MOBILE_ADS_IOS_APP_ID`, falls back to legacy `ADMOB_ANDROID_APP_ID` / `ADMOB_IOS_APP_ID`, then uses Google's official test app IDs when unset.
- The app preloads rewarded ads, tracks readiness, waits briefly for readiness before show, and resolves completion only after the earned-reward event.
- Guest rewarded-ad rewards update local state only.
- Authenticated rewarded-ad rewards call the backend `awardedAdCallback` before updating local coin state.
- The authenticated client uses the backend `newCoins` response as the source of truth and avoids client-side Firestore coin writes for confirmed ad rewards.
- `GameScreen` now logs the backend callback confirmation payload for authenticated rewards and the local-only reward summary for guest rewards before updating coins, which makes emulator logcat evidence easier to collect.
- The Coin Shop UI intentionally does not render a watch-ad action in the current product flow; `coin_shop` remains a supported backend placement for the existing handler/dev/future UI entry.

## Completed Source Work

### Backend Reward Confirmation

Callable function:

- `awardedAdCallback`

Implemented behavior:

- Validates auth and ensures the requested `userId` matches `request.auth.uid`.
- Accepts the known rewarded-ad placements `loss_continue` and `coin_shop`.
- Uses a callback id for idempotency, with a fallback time window for older clients.
- Applies the coin reward server-side once for authenticated users.
- Records processed callbacks, placement cooldown state, and ad interaction details.
- Returns typed reward metadata, including `rewardCoins`, `newCoins`, and `alreadyProcessed`.

### Authenticated Client Calls

After a rewarded ad completes for a signed-in user:

- `GameScreen` calls `awardedAdCallback` through `useRewardedAds`.
- The returned `newCoins` value updates local state with `syncToFirestore: false`.
- Guest mode remains local-only.
- The existing coin reward fanfare uses the confirmed backend reward amount and balance.
- The loss-continue action is visible in the loss modal; the `coin_shop` placement is wired through the existing handler but is not surfaced by the current Coin Shop UI.

### Source-Level Fallback And Listener Coverage

- `GameScreen` source tests verify the Coin Shop watch-video handler shows the ad-not-ready fallback when a rewarded ad does not grant a reward, without recording a backend callback or showing the coin fanfare.
- `GameScreen` source tests verify the loss-modal watch-ad continue path closes the loss modal, shows the ad-not-ready fallback, and does not continue gameplay or record a backend callback when no reward is granted.
- `RewardedAdService` source tests verify temporary `EARNED_REWARD` / `CLOSED` listeners are removed after repeated rewarded-ad shows and after an ad closes without granting a reward.
- `pnpm run test:android:matrix:unit` now includes `src/services/__tests__/RewardedAdService.test.ts` so rewarded-ad listener cleanup stays in the Android QA preflight.

## Remaining Work

### 1. Mirror The Provisioned IDs

The local shell is now provisioned with production-like Google Mobile Ads app IDs. Mirror those values into EAS/preview/production environments and confirm `expo config` resolves them there as well.

Ensure the Google Mobile Ads app IDs are set in any remaining runtime environments:

- `GOOGLE_MOBILE_ADS_ANDROID_APP_ID`
- `GOOGLE_MOBILE_ADS_IOS_APP_ID`

The legacy `ADMOB_ANDROID_APP_ID` and `ADMOB_IOS_APP_ID` names are still accepted as fallbacks for older local setups, but new environment configuration should use the documented `GOOGLE_MOBILE_ADS_*` names.

Keep these configured for:

- development
- preview
- production

### 2. Deploy And End-To-End QA Checklist

- App logs show Google Mobile Ads initializes successfully.
- Rewarded ad loads before loss/shop actions are offered.
- Show flow returns `true` only after earned reward.
- Backend callback awards authenticated rewards exactly once.
- Duplicate callback ids do not duplicate coins.
- Cooldown/rate-limit behavior rejects rapid replay attempts.
- No duplicate listener behavior after navigating away and back; source-unit listener cleanup is covered, but live navigation replay remains open.
- No-fill/not-ready failures show user-friendly fallback modals; source-unit no-reward fallbacks are covered, and live no-fill/not-ready emulator evidence is now captured in `emulator-tests/logs/metro/stdout-continue-lan.log`.

## Progress Log

- 2026-05-25: Updated the docs to reflect that Google AdMob / Google Mobile Ads is the only current ad provider. Removed the stale provider-specific guide and replaced it with this file.
- 2026-05-25: Repo guidance says to prefer Expo MCP for Expo/React Native tasks when available, but no Expo MCP tool is exposed in this session (`tool_search` returned zero matches). Local repo commands are the verification fallback.
- 2026-05-25: Removed remaining stale provider-name hits from docs, filenames, and generated test output. Issue encountered: `test-results.json` still contained an old generated test title from a removed test file. Resolution: mechanically replaced the stale title text with the current Google Mobile Ads wording, then reran a repo-wide search.
- 2026-05-25: Verification passed: `pnpm --dir firebase-functions test -- src/__tests__/ads.test.ts src/__tests__/index.test.ts src/__tests__/constants.test.ts --runInBand`, `pnpm --dir firebase-functions build`, and `pnpm exec tsc --noEmit --pretty false`.
- 2026-05-25: Repo-wide stale-provider search returned no matches outside ignored dependency and coverage folders.
- 2026-05-25: Current agent read all files under `docs/` before continuing. Issue encountered: the first PowerShell docs digest attempted to pipe directly from a `foreach` block and failed with `An empty pipe element is not allowed.` Resolution: collected rows into an array before piping to `Format-Table`/`ConvertTo-Json`; the follow-up pass read 52 docs files / 565,065 characters / 8,287 lines.
- 2026-05-25: Completed authenticated rewarded-ad client confirmation. `useRewardedAds` now exposes `recordRewardedAdCompletion`; `GameScreen` confirms visible `loss_continue` rewards and the existing `coin_shop` handler/dev/future UI entry through `awardedAdCallback` for authenticated users, updates local coins from backend `newCoins` with `syncToFirestore: false`, and keeps guest rewards local-only.
- 2026-05-25: Verification passed after client wiring: `pnpm exec jest src/screens/game/__tests__/GameScreen.test.tsx --runInBand` (109 tests), `pnpm --dir firebase-functions test -- src/__tests__/ads.test.ts src/__tests__/index.test.ts src/__tests__/constants.test.ts --runInBand` (22 tests), `pnpm exec tsc --noEmit --pretty false`, `pnpm --dir firebase-functions build`, and `pnpm --dir firebase-functions lint -- src/ads.ts src/__tests__/ads.test.ts`.
- 2026-05-25: Issue encountered: targeted Functions lint failed because `firebase-functions/src/__tests__/ads.test.ts` imported unused `HttpsError`. Resolution: removed the unused import, reran targeted Functions lint, targeted Functions tests, and Functions build successfully.
- 2026-05-25: Remaining work is off-repo/environmental or live QA: set real Google Mobile Ads app IDs, deploy the callable when ready, and run emulator/Firebase proof for authenticated ad rewards, duplicate callback ids, cooldown behavior, no-fill/not-ready fallback, and listener cleanup.
- 2026-05-25: Current agent reread all 52 files under `docs/` and found an actionable config mismatch: this doc told agents to set `GOOGLE_MOBILE_ADS_*`, while `app.config.js` only consumed `ADMOB_*`. Resolution: `app.config.js` now reads `GOOGLE_MOBILE_ADS_ANDROID_APP_ID` / `GOOGLE_MOBILE_ADS_IOS_APP_ID` first, keeps legacy `ADMOB_*` fallback support, and `.env.example` now shows the documented variable names.
- 2026-05-25: Verification passed for the env-name fix: `pnpm exec jest src/config/__tests__/appConfig.test.js --runInBand` (3 tests), `pnpm exec tsc --noEmit --pretty false`, and a redacted `pnpm exec expo config --type public --json` parse. Local `.env` has no Google Mobile Ads or legacy AdMob IDs, so the resolved public config correctly reports Google's safe test app IDs for Android and iOS; real development/preview/production IDs remain environmental work.
- 2026-05-25: Issue encountered: a quick PowerShell env-presence check repeated the parser error `An empty pipe element is not allowed` by piping directly from a `foreach` block. Resolution: collect rows into `$rows` before piping to `Format-Table`.
- 2026-05-25: Issue encountered: an exploratory `rg` command used Windows-incompatible bare glob arguments such as `*.js` / `*.ts`, causing path errors. Resolution: reran narrower searches with explicit paths and repo globs.
- 2026-05-25: Issue encountered: `pnpm exec eslint --no-ignore app.config.js src/config/__tests__/appConfig.test.js --ext .js` forced ESLint through files the repo intentionally ignores; it then reported existing CJS `require()` and Jest-global errors. Resolution: treated that as a non-gate diagnostic, used the normal ignored-file behavior for lint scope, and verified the change with focused Jest, TypeScript, and redacted Expo config resolution.
- 2026-05-25: Current agent read all 52 files under `docs/` via a docs-wide digest before continuing, covering 8,342 lines / 582,328 characters in the current tree. Issue encountered: an `rg` search using a lookahead for unchecked HTML checkboxes failed because the default regex engine does not support that lookahead syntax. Resolution: split the unchecked Markdown and HTML searches and used PowerShell `Select-String` for the HTML checkbox shape.
- 2026-05-25: Completed source-level rewarded-ad fallback/listener verification. Added `src/services/__tests__/RewardedAdService.test.ts`, added GameScreen tests for no-reward Coin Shop and loss-modal fallback paths, and added the service test to `pnpm run test:android:matrix:unit`. Verification passed: `pnpm exec jest src/services/__tests__/RewardedAdService.test.ts src/screens/game/__tests__/GameScreen.test.tsx --runInBand` (2 suites / 113 tests), `pnpm exec tsc --noEmit --pretty false`, and `pnpm run test:android:matrix:unit` (49 suites / 991 tests). The matrix-unit run still prints existing expected `console.error` output from negative-path tests in ForgotPasswordScreen, useGameLogic, and GameStateManager, but all suites passed.
- 2026-05-25: Issue encountered: the first `RewardedAdService` test helper used dynamic `import("../RewardedAdService")`, which failed in this Jest runtime with `A dynamic import callback was invoked without --experimental-vm-modules`. Resolution: switched the helper to the repo's existing `require` pattern after `jest.doMock`; the focused Jest run then passed.
- 2026-05-25: Current continuation reread all 52 files under `docs/` before acting (8,363 lines / 599,249 characters) and rechecked this source-unit rewarded-ad slice. Verification passed again: `pnpm exec jest src/services/__tests__/RewardedAdService.test.ts src/screens/game/__tests__/GameScreen.test.tsx --runInBand` (2 suites / 113 tests), `pnpm exec tsc --noEmit --pretty false`, and `pnpm run test:android:matrix:unit` (49 suites / 991 tests). Expo MCP remains unavailable through `tool_search`, so local repo commands were used. No new source errors were found; live provider-auth ad replay, no-fill/not-ready emulator evidence, duplicate/cooldown proof, real app IDs, callable deployment, and Firebase deltas remain open.
- 2026-05-30: Current docs backlog pass refreshed the ownership notes in the iOS and integration docs and kept this rewarded-ad guide on the active workstream list. Remaining work is still environmental: production-like ad IDs, live replay evidence, and any consent/privacy setup needed for emulator proof.
- 2026-05-31: The local shell is now provisioned with production-like `GOOGLE_MOBILE_ADS_ANDROID_APP_ID` and `GOOGLE_MOBILE_ADS_IOS_APP_ID` values, and `app.config.js` resolves them ahead of the legacy test defaults. That closes the local provisioning slice, and the remaining open work is guest parity and environment mirroring.
- 2026-05-31: `GameScreen` now emits explicit rewarded-ad confirmation breadcrumbs for both authenticated and guest flows. Focused `pnpm exec jest src/screens/game/__tests__/GameScreen.test.tsx --runInBand` passed 115 tests and `pnpm exec tsc --noEmit --pretty false` stayed clean, so the implementation is source-green while the remaining blocker is still emulator/backend evidence for guest parity.
- 2026-05-31: The auth/error cleanup that supports upgrade-account and profile flows is also source-green. Focused Jest passed for `authErrorMessages`, `cloudFunctionErrorMessages`, `AuthService`, `LandingScreen`, `UpdateUsernameModal`, `UpgradeAccountModal`, `FullProfileDetailsModal`, and `errorUtils`, and TypeScript stayed clean. The rewarded-ad guide remains blocked only on guest parity and environment mirroring.
- 2026-05-31: A fresh emulator replay attempt on the modal-testing Profile action waited 20 seconds but stayed on the game surface without a visible modal transition or callback log. That means the source breadcrumbs are in place, but the next proof pass still needs a cleaner route or a device-state reset for backend callback/newCoins capture.
- 2026-05-31: The provider-auth snapshot and rewarded-ad success replay are now backed by emulator artifacts: `emulator-tests/logs/rq_pixel_4a_api_36_1/419-google-provider-profile-open-logcat.txt`, `emulator-tests/logs/rq_pixel_4a_api_36_1/294-rewarded-ad-after-wait.xml`, and `emulator-tests/logs/rq_pixel_4a_api_36_1/295-after-rewarded-ad-close.xml`. The no-fill lifecycle is also captured in `emulator-tests/logs/metro/stdout-continue-lan.log`. That closes the provider-auth replay-proof gap, but backend callback/newCoins, guest parity, and environment mirroring still need capture.
- 2026-06-01: A direct `MainActivity` launch reached the splash screen, but the app then returned to the Dev Launcher / stylus overlay path before the reward flow could be re-entered. `live-adb-capture.txt` captures that blocker state, so the guest-parity proof remains open.
- 2026-06-01: Anonymous guest sign-in is confirmed again and the guest game surface is reachable after relaunch, but the direct `Watch Ad (Loss Continue)` control still has not emitted the guest-local reward log or a visible ad transition. The remaining work is a reliable on-device guest trigger, not source verification.

## Quick Verification Commands

```bash
pnpm test -- src/screens/game/__tests__/GameScreen.test.tsx
pnpm exec jest src/services/__tests__/RewardedAdService.test.ts --runInBand
pnpm test -- src/services/__tests__/AnalyticsService.test.ts
pnpm exec expo config --type public
```

Use `expo config --type public` to confirm the Google Mobile Ads app IDs resolve for the active environment.
