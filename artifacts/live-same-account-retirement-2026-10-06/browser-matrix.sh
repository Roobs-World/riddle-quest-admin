#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
report="/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-same-account-retirement-2026-10-06"
for browser in chromium firefox; do
 for mode in development production; do
  LIVE_SAME_BROWSER="$browser" LIVE_SAME_REACT_MODE="$mode" LIVE_SAME_REPORT_DIR="$report/same-$browser-$mode" node packages/portal/scripts/verify-live-same-account-retirement-browser.mjs > "$report/same-$browser-$mode.log" 2>&1
  printf '%s %s same-account passed\n' "$browser" "$mode"
  LIVE_WAIT_BROWSER="$browser" LIVE_WAIT_FIREFOX_EXECUTABLE="/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox" LIVE_WAIT_REACT_MODE="$mode" LIVE_WAIT_REPORT_DIR="$report/legacy-$browser-$mode" node packages/portal/scripts/verify-live-retired-leave-recovery-browser.mjs > "$report/legacy-$browser-$mode.log" 2>&1
  printf '%s %s legacy cleanup passed\n' "$browser" "$mode"
 done
done
LIVE_CONFIRM_REPORT_DIR="$report/confirmation" node packages/portal/scripts/verify-live-confirmation-retirement-browser.mjs > "$report/confirmation.log" 2>&1
LIVE_RACE_REPORT_DIR="$report/active-close" node packages/portal/scripts/verify-live-race-browser.mjs > "$report/active-close.log" 2>&1
