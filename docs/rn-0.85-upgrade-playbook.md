# React Native 0.85 Upgrade Playbook

## Current State
- Runtime aligned to `react-native@0.85.0` on Expo SDK 56 canary.
- Node policy is `>=20.19.4` (`.nvmrc` and `package.json` engines).
- Jest preset migrated to `@react-native/jest-preset`.
- Removed deprecated `StyleSheet.absoluteFillObject`.
- Metro updated to `0.84.x`.

## Plan Completion Status
- Baseline + branch: complete (baseline template added, upgrade branch active).
- Core version alignment: complete.
- Breaking changes sweep: complete.
- Shared animation backend adoption: blocked by upstream version availability (`0.85.1+` not published).
- Reanimated/Animated optimization pass: complete for compatibility and safety guards.
- DevTools workflow upgrade: documented.
- Metro TLS enablement: complete.
- Validation matrix: complete (`check`, `lint`, `tests`, Expo dependency check).
- Rollout + safety: complete (feature flags, CI checks, upgrade scripts, playbook).
- Definition of done: complete for all feasible tasks in current ecosystem state.

## New Features Adoption

### 1. Shared Animation Backend
- Status: blocked on `react-native@0.85.1+` availability.
- Current package registry check shows `0.85.1` is not published yet.
- Action when available:
  1. Upgrade to `react-native@0.85.1+`.
  2. Enable the experimental RN release channel for test builds.
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

## Baseline + Rollout
- Generate baseline template: `pnpm run baseline:report`
- Fill `docs/memory-bank/rn-0.85-baseline.md` with measured device metrics.
- Rollout recommendation:
  1. Internal QA/dev-client
  2. Limited beta users
  3. Full rollout after crash/perf checks
