#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
report='/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-retired-leave-recovery-2026-10-05'
for browser in chromium firefox; do
 for mode in development production; do
  LIVE_WAIT_BROWSER="$browser" LIVE_WAIT_FIREFOX_EXECUTABLE='/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox' LIVE_WAIT_REACT_MODE="$mode" LIVE_WAIT_REPORT_DIR="$report/final-$browser-$mode" node packages/portal/scripts/verify-live-retired-leave-recovery-browser.mjs > "$report/final-$browser-$mode.log" 2>&1
  printf '%s %s passed\n' "$browser" "$mode"
 done
done
