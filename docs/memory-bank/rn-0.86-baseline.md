# RN 0.86 Baseline

Generated: 2026-06-19T23:15:37.531Z

## Environment
- Node: v24.17.0
- PNPM: 10.33.0
- Expo CLI: 56.1.16
- Git commit: e08d428a0

## Runtime Versions
- react-native: 0.86.0
- react: 19.2.3
- expo: 56.0.12
- reanimated: 4.4.1

## Measured Baseline

- Android cold launch `adb am start -W` wait time: pending
- Android warm launch `adb am start -W` wait time: pending
- Android Hermes bundle size: pending
- Expo export elapsed time for the bundle smoke: pending
- Bundle smoke gate threshold: pending
- Live memory snapshot: pending
- Live frame snapshot: pending

## Still Pending

- Memory snapshot around scene preload and modal-heavy flows
- Render jank on hot game and modal transition paths
- JS frame rate on gameplay screen
- iOS launch and profiling parity
- Crash-free sessions after rollout

## Notes
- Fill this file with measured values from CI/device profiling runs as new data lands.
