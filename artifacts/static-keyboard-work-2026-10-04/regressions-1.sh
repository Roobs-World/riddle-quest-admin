#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
for mode in development production; do
 env RACE_ACTION_FOCUS_REACT_MODE="$mode" RACE_ACTION_FOCUS_REPORT_DIR="../../artifacts/static-keyboard-work-2026-10-04/regression-race-action-focus/$mode" pnpm --dir packages/portal exec node scripts/verify-race-action-focus-browser.mjs > "artifacts/static-keyboard-work-2026-10-04/regression-race-action-focus-$mode.log" 2>&1
done
printf 'race-action-focus passed\n'
for mode in development production; do
 env PLAYABLE_FOCUS_REACT_MODE="$mode" PLAYABLE_FOCUS_REPORT_DIR="../../artifacts/static-keyboard-work-2026-10-04/regression-playable-action-focus/$mode" pnpm --dir packages/portal exec node scripts/verify-playable-action-focus-browser.mjs > "artifacts/static-keyboard-work-2026-10-04/regression-playable-action-focus-$mode.log" 2>&1
done
printf 'playable-action-focus passed\n'
