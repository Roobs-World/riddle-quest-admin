#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
for mode in development production; do
 env RACE_ACTION_FOCUS_REACT_MODE="$mode" RACE_ACTION_FOCUS_REPORT_DIR="../../artifacts/live-callback-lifetime-2026-10-04/regression-race-action-focus/$mode" pnpm --dir packages/portal exec node scripts/verify-race-action-focus-browser.mjs > "artifacts/live-callback-lifetime-2026-10-04/regression-race-action-focus-$mode.log" 2>&1
done
printf 'race-action-focus passed\n'
for mode in development production; do
 env LIVE_CLOCK_REACT_MODE="$mode" LIVE_CLOCK_REPORT_DIR="../../artifacts/live-callback-lifetime-2026-10-04/regression-live-clock-visibility/$mode" pnpm --dir packages/portal exec node scripts/verify-live-clock-visibility-browser.mjs > "artifacts/live-callback-lifetime-2026-10-04/regression-live-clock-visibility-$mode.log" 2>&1
done
printf 'live-clock-visibility passed\n'
for mode in development production; do
 env STATIC_KEYBOARD_REACT_MODE="$mode" STATIC_KEYBOARD_REPORT_DIR="../../artifacts/live-callback-lifetime-2026-10-04/regression-static-keyboard-work/$mode" pnpm --dir packages/portal exec node scripts/verify-static-keyboard-work-browser.mjs > "artifacts/live-callback-lifetime-2026-10-04/regression-static-keyboard-work-$mode.log" 2>&1
done
printf 'static-keyboard-work passed\n'
for mode in development production; do
 env KEYBOARD_REACT_MODE="$mode" KEYBOARD_REPORT_DIR="../../artifacts/live-callback-lifetime-2026-10-04/regression-game-keyboard-lifetime/$mode" pnpm --dir packages/portal exec node scripts/verify-game-keyboard-lifetime-browser.mjs > "artifacts/live-callback-lifetime-2026-10-04/regression-game-keyboard-lifetime-$mode.log" 2>&1
done
printf 'game-keyboard-lifetime passed\n'
