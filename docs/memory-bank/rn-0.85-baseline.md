# RN 0.85 Baseline

Generated: 2026-05-30T14:34:50.790Z
Last measured: 2026-05-30

## Environment
- Node: v22.22.2
- PNPM: 10.33.0
- Expo CLI: 56.1.12
- Git commit: 9620b516

## Runtime Versions
- react-native: 0.85.3
- react: 19.2.3
- expo: 56.0.5
- reanimated: 4.3.1

## Measured Baseline

- Android cold launch `adb am start -W` wait time: 2,221 ms
- Android warm launch `adb am start -W` wait time: 6 ms
- Android Hermes bundle size: 10,726,291 bytes (10.23 MiB)
- Expo export elapsed time for the bundle smoke: 42,007 ms
- Bundle smoke gate threshold: 12,582,912 bytes
- Live memory snapshot: TOTAL PSS 858,870 KB, Native Heap 540,024 KB, Java Heap 44,572 KB
- Live frame snapshot: 909 frames rendered, 460 janky frames (50.61%), 90th percentile 32 ms, 95th percentile 34 ms

## Still Pending

These are long-horizon profiling targets, not active blocker items for the current docs pass.

- Memory snapshot around scene preload and modal-heavy flows
- Render jank on hot game and modal transition paths
- JS frame rate on gameplay screen
- iOS launch and profiling parity
- Crash-free sessions after rollout

## Notes
- Android launch numbers came from the live `emulator-5554` Pixel 4a session and the archived manual launch logs for the earlier baseline.
- Memory came from `emulator-tests/logs/perf-baseline-20260530/meminfo.txt`.
- Frame stats came from `emulator-tests/logs/perf-baseline-20260530/framestats.txt`.
- Android bundle size came from `pnpm run perf:bundle-smoke` and the exported `_expo/static/js/android/*.hbc` artifact.
- The bundle-size smoke gate is available as `pnpm run perf:bundle-smoke`.
- The baseline metadata refresh is available as `pnpm run baseline:report`; it preserves measured baseline and notes sections.
- Keep filling this file with measured values from CI/device profiling runs as new data lands.
