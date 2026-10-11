#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
export PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH=/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox
for engine in chromium firefox; do
 for mode in development production; do
  for viewport in '390 568' '390 844' '1280 844'; do
   read -r width height <<< "$viewport"
   report="/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-safety-focus-2026-10-08/matrix-$engine-$mode-$width-$height"
   SAFETY_FOCUS_ENGINE="$engine" SAFETY_FOCUS_REACT_MODE="$mode" SAFETY_FOCUS_WIDTH="$width" SAFETY_FOCUS_HEIGHT="$height" SAFETY_FOCUS_REPORT_DIR="$report" node packages/portal/scripts/verify-live-safety-focus-browser.mjs > "$report.log" 2>&1
  done
 done
done
for mode in development production; do
 RACE_TAB_REACT_MODE="$mode" RACE_TAB_REPORT_DIR="/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-safety-focus-2026-10-08/tab-$mode" node packages/portal/scripts/verify-race-tab-order-browser.mjs > "artifacts/live-safety-focus-2026-10-08/tab-$mode.log" 2>&1
done
