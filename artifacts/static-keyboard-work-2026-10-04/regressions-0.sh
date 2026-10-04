#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
for mode in development production; do
 env KEYBOARD_REACT_MODE="$mode" KEYBOARD_REPORT_DIR="../../artifacts/static-keyboard-work-2026-10-04/regression-game-keyboard-lifetime/$mode" pnpm --dir packages/portal exec node scripts/verify-game-keyboard-lifetime-browser.mjs > "artifacts/static-keyboard-work-2026-10-04/regression-game-keyboard-lifetime-$mode.log" 2>&1
done
printf 'game-keyboard-lifetime passed\n'
for mode in development production; do
 env BOUNDED_GRAPHEME_REACT_MODE="$mode" BOUNDED_GRAPHEME_REPORT_DIR="../../artifacts/static-keyboard-work-2026-10-04/regression-bounded-grapheme-input/$mode" pnpm --dir packages/portal exec node scripts/verify-bounded-grapheme-input-browser.mjs > "artifacts/static-keyboard-work-2026-10-04/regression-bounded-grapheme-input-$mode.log" 2>&1
done
printf 'bounded-grapheme-input passed\n'
