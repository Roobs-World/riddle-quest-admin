#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
for mode in development production; do
 env LIVE_CALLBACK_REACT_MODE="$mode" LIVE_CALLBACK_REPORT_DIR="../../artifacts/live-provider-retirement-2026-10-04/regression-live-callback-lifetime/$mode" pnpm --dir packages/portal exec node scripts/verify-live-callback-lifetime-browser.mjs > "artifacts/live-provider-retirement-2026-10-04/regression-live-callback-lifetime-$mode.log" 2>&1
done
printf 'live-callback-lifetime passed\n'
for mode in development production; do
 env RACE_ACTION_FOCUS_REACT_MODE="$mode" RACE_ACTION_FOCUS_REPORT_DIR="../../artifacts/live-provider-retirement-2026-10-04/regression-race-action-focus/$mode" pnpm --dir packages/portal exec node scripts/verify-race-action-focus-browser.mjs > "artifacts/live-provider-retirement-2026-10-04/regression-race-action-focus-$mode.log" 2>&1
done
printf 'race-action-focus passed\n'
for mode in development production; do
 env LIVE_CLOCK_REACT_MODE="$mode" LIVE_CLOCK_REPORT_DIR="../../artifacts/live-provider-retirement-2026-10-04/regression-live-clock-visibility/$mode" pnpm --dir packages/portal exec node scripts/verify-live-clock-visibility-browser.mjs > "artifacts/live-provider-retirement-2026-10-04/regression-live-clock-visibility-$mode.log" 2>&1
done
printf 'live-clock-visibility passed\n'
