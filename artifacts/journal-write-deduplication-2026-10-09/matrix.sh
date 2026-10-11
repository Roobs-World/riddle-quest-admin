#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
export PENDING_LIFE_FIREFOX_EXECUTABLE=/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox
report=artifacts/journal-write-deduplication-2026-10-09
for browser in chromium firefox; do
 for mode in development production; do
  PENDING_LIFE_BROWSER="$browser" PENDING_LIFE_MODE="$mode" PENDING_LIFE_REPORT_DIR="$PWD/$report/$browser-$mode" node packages/portal/scripts/verify-journal-write-work-browser.mjs > "$report/$browser-$mode.log" 2>&1
  PENDING_LIFE_BROWSER="$browser" PENDING_LIFE_MODE="$mode" PENDING_LIFE_REPORT_DIR="$PWD/$report/lifetime-$browser-$mode" node packages/portal/scripts/verify-pending-play-lifetime-browser.mjs > "$report/lifetime-$browser-$mode.log" 2>&1
 done
done
