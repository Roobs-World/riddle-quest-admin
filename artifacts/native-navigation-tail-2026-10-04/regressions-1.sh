#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
for mode in development production; do
 env PLAYABLE_IME_REACT_MODE="$mode" PLAYABLE_IME_REPORT_DIR="../../artifacts/native-navigation-tail-2026-10-04/regression-playable-ime-boundary/$mode" pnpm --dir packages/portal exec node scripts/verify-playable-ime-boundary-browser.mjs > "artifacts/native-navigation-tail-2026-10-04/regression-playable-ime-boundary-$mode.log" 2>&1
done
printf 'playable-ime-boundary passed\n'
for mode in development production; do
 env RACE_IME_DIALOG_REACT_MODE="$mode" RACE_IME_DIALOG_REPORT_DIR="../../artifacts/native-navigation-tail-2026-10-04/regression-race-ime-dialog/$mode" pnpm --dir packages/portal exec node scripts/verify-race-ime-dialog-browser.mjs > "artifacts/native-navigation-tail-2026-10-04/regression-race-ime-dialog-$mode.log" 2>&1
done
printf 'race-ime-dialog passed\n'
for mode in development production; do
 env RACE_ACTION_FOCUS_REACT_MODE="$mode" RACE_ACTION_FOCUS_REPORT_DIR="../../artifacts/native-navigation-tail-2026-10-04/regression-race-action-focus/$mode" pnpm --dir packages/portal exec node scripts/verify-race-action-focus-browser.mjs > "artifacts/native-navigation-tail-2026-10-04/regression-race-action-focus-$mode.log" 2>&1
done
printf 'race-action-focus passed\n'
