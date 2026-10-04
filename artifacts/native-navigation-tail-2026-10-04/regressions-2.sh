#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
for mode in development production; do
 env RAPID_ANSWER_REACT_MODE="$mode" RAPID_ANSWER_REPORT_DIR="../../artifacts/native-navigation-tail-2026-10-04/regression-rapid-answer-edits/$mode" pnpm --dir packages/portal exec node scripts/verify-rapid-answer-edits-browser.mjs > "artifacts/native-navigation-tail-2026-10-04/regression-rapid-answer-edits-$mode.log" 2>&1
done
printf 'rapid-answer-edits passed\n'
for mode in development production; do
 env LIVE_IMMEDIATE_REACT_MODE="$mode" LIVE_IMMEDIATE_REPORT_DIR="../../artifacts/native-navigation-tail-2026-10-04/regression-live-immediate-submit/$mode" pnpm --dir packages/portal exec node scripts/verify-live-immediate-submit-browser.mjs > "artifacts/native-navigation-tail-2026-10-04/regression-live-immediate-submit-$mode.log" 2>&1
done
printf 'live-immediate-submit passed\n'
for mode in development production; do
 env PLAYABLE_FOCUS_REACT_MODE="$mode" PLAYABLE_FOCUS_REPORT_DIR="../../artifacts/native-navigation-tail-2026-10-04/regression-playable-action-focus/$mode" pnpm --dir packages/portal exec node scripts/verify-playable-action-focus-browser.mjs > "artifacts/native-navigation-tail-2026-10-04/regression-playable-action-focus-$mode.log" 2>&1
done
printf 'playable-action-focus passed\n'
