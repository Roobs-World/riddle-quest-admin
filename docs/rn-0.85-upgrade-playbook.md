# React Native 0.85 / Expo SDK 56 Playbook

## Current State

- Runtime aligned to `react-native@0.85.3`, Expo SDK 56's bundled native version.
- Node policy is `>=20.19.4` (`.nvmrc` and `package.json` engines).
- Jest preset migrated to `@react-native/jest-preset`.
- Removed deprecated `StyleSheet.absoluteFillObject`.
- Metro updated to `0.84.x`.

## Plan Completion Status

- Baseline + branch: complete (baseline template added, upgrade branch active).
- Core version alignment: complete on Expo SDK 56's bundled RN line.
- Breaking changes sweep: complete.
- Shared animation backend adoption: blocked on the Expo SDK 56 native bundle; the runtime flag remains off by default for targeted experimental-channel builds only.
- Reanimated/Animated optimization pass: complete for compatibility and safety guards.
- DevTools workflow upgrade: documented.
- Metro TLS enablement: complete.
- Validation matrix: complete (`check`, `lint`, `tests`, Expo dependency check).
- Rollout + safety: complete (feature flags, CI checks, upgrade scripts, playbook).
- Definition of done: complete for all feasible tasks in current ecosystem state.

## New Features Adoption

### 1. Shared Animation Backend

- Status: deferred until the Expo SDK native bundle supports the required React Native line.
- Keep `EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND=false` by default.
- Action for targeted experimental test builds:
  1. Enable `EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND=true`.
  2. Enable the experimental RN release channel for that build.
  3. Validate layout animations with native driver on key screens.

### 2. Metro TLS

- TLS support is now wired in `metro.config.js`.
- Set env vars before running Metro:
  - `METRO_TLS_CERT_PATH`
  - `METRO_TLS_KEY_PATH`
  - Optional: `METRO_TLS_CA_PATH`
- This enables HTTPS + WSS Fast Refresh for secure local API testing.

### 3. DevTools Multi-Connection Workflow

- Use multiple CDP clients in parallel:
  - React Native DevTools
  - VS Code debugger
  - AI agents/tools
- Keep one profiling session focused on render/frames and another on network.

## Validation Commands

- `pnpm run check:rn-upgrade`
- `pnpm run lint`
- `pnpm run test:rn -- --runInBand`
- `pnpm exec expo install --check`

## 2026-06-20 Expo SDK 56 Alignment Notes

- Backed the runtime down to Expo SDK 56's bundled native versions: `react-native@0.85.3`, `react-native-reanimated@4.3.1`, and `react-native-worklets@0.8.3`.
- Removed `react-native`, `react-native-reanimated`, and `react-native-worklets` from `expo.install.exclude` so Expo dependency validation catches future drift.
- Removed direct `expo-modules-core` and local `eas-cli` dependencies after `expo-doctor` flagged them.
- Root cause for the rollback: `react-native@0.86.0` built `libreactnative.so` without the JSI symbol shape expected by `expo-gl@56.0.5`, causing `libexpo-gl.so` to fail loading on Android devices.

## 2026-06-20 React Native 0.86 Update Notes

- Superseded by the Expo SDK 56 alignment notes above.
- Verified published package metadata with `pnpm view react-native@0.86 version`; latest resolved to `0.86.0` with React `^19.2.3` and `@react-native/jest-preset@0.86.0` peers.
- Updated runtime pins to `react-native@0.86.0`, `react-native-reanimated@4.4.1`, and `react-native-worklets@0.9.2`.
- Updated test preset pin to `@react-native/jest-preset@0.86.0`.
- Expo CLI install was attempted for Reanimated/Worklets first, but pnpm's workspace-root guard blocked Expo's generated `pnpm add` command because it omitted `-w`; the same explicit workspace-root pnpm fallback used for the RN pin was applied.
- `react-native`, `react-native-reanimated`, `react-native-worklets`, and `@react-native/jest-preset` are listed in `expo.install.exclude` because they intentionally move ahead of Expo SDK 56's current dependency validator.
- Remaining ecosystem caveat: `expo-modules-core@56.0.17` still declares a peer range for `react-native-worklets` up to `0.8.x`, and `jest-expo@56.0.5` still declares `@react-native/jest-preset@^0.85.0`.

## 2026-05-25 Continuation Notes

- Read all 52 files under `docs/` before continuing this task.
- Verified package availability with `pnpm view react-native@0.85.1 version` and `pnpm view @react-native/jest-preset@0.85.1 version`; both returned `0.85.1`.
- Before the upgrade, `pnpm exec expo install --check` reported dependencies up to date, with the canary-SDK reliability caveat.
- Used the Expo-recommended install path first for `react-native@0.85.1` because this is an Expo/React Native project and no Expo MCP tool is exposed in this session.
- Issue encountered: running the React Native install and Jest preset install concurrently on Windows caused pnpm `ENOTEMPTY` / `EPERM` rename failures in `node_modules`.
- Resolution: updated the declared versions to `react-native@0.85.1` and `@react-native/jest-preset@0.85.1`, rebuilt the lockfile with `pnpm install --lockfile-only`, then reconciled `node_modules` with a single sequential `pnpm install --prefer-offline`.
- Issue encountered: after the deliberate RN patch upgrade, `pnpm exec expo install --check` failed because the Expo SDK 56 canary dependency validator still expects `react-native@0.85.0`.
- Resolution: added `react-native` to `expo.install.exclude` in `package.json`, matching the Expo CLI guidance for explicitly provided versions; `pnpm exec expo install --check` then passed and reported `react-native` as intentionally skipped.
- Guardrail updated: `scripts/check-rn-upgrade.js` now expects the 0.85.1 runtime and Jest preset versions.
- Verification passed: `pnpm run check:rn-upgrade`, `pnpm exec jest src/config/__tests__/featureFlags.test.ts --runInBand` (26 tests), `pnpm exec tsc --noEmit --pretty false`, and `pnpm exec expo install --check`.
- Full RN suite follow-up: the first `pnpm run test:rn -- --runInBand` pass after the version bump failed in stale unit-test areas, not from the RN patch itself.
- Issue encountered: `UserDataService.test.ts` and `FirestoreService.test.ts` still expected direct client writes for progress, economy, stats, and daily/classic progress fields. The current architecture delegates those server-managed writes to Cloud Functions and intentionally logs skipped direct writes.
- Resolution: updated the service tests to assert the server-authoritative write contract, including the `initializeUser` callable path and sanitized client-editable user updates.
- Issue encountered: `AppStrings.i18n.test.ts` caught missing explicit locale values for new About/Legal, account deletion, and leaderboard guest strings.
- Resolution: added release-readiness locale supplements and merged them into all non-English override exports, including the popular-language bundles.
- Issue encountered: `responsive-surface-coverage.test.ts` still looked for LoginScreen's old `authContentContainer` marker after the screen moved to the current `AuthLayout` + `isWideAuthLayout` responsive path.
- Resolution: refreshed the marker to the current `isWideAuthLayout` hook.
- Issue encountered: `SolarSystem3D.test.tsx` mocked the R3F `gl` object without the newer `getContext().pixelStorei` shape used to suppress unsupported Expo GL pixel-store flags.
- Resolution: extended the test mock with `gl.getContext()` and `pixelStorei`.
- Issue encountered: a TypeScript fixture cleanup was needed after the Firestore test update because a seeded stats spread could overwrite explicitly declared stat keys.
- Resolution: cast the spread portion to a generic record in the fixture, preserving the runtime assertion while satisfying `tsc`.
- Final verification passed on 2026-05-25: `pnpm run test:rn -- --runInBand` (175 suites, 3614 tests), `pnpm exec tsc --noEmit --pretty false`, `pnpm run check:rn-upgrade`, and `pnpm exec expo install --check`.
- Note for future agents: the full RN suite still prints expected console noise from tests that intentionally exercise error paths and from async SolarSystem3D texture updates, but Jest exits 0 with all suites passing.

## Baseline + Rollout

- Generate baseline template: `pnpm run baseline:report`
- Fill `docs/memory-bank/rn-0.85-baseline.md` with measured device metrics.
- Rollout recommendation:
  1. Internal QA/dev-client
  2. Limited beta users
  3. Full rollout after crash/perf checks
