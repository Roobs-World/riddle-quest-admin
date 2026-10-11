#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
export PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH=/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox
report=artifacts/pagehide-checkpoint-fix-2026-10-09
for browser in chromium firefox; do
 for mode in development production; do
  for lifecycle in visibility pagehide both; do
   CHECKPOINT_COMMIT_BROWSER="$browser" CHECKPOINT_COMMIT_REACT_MODE="$mode" CHECKPOINT_COMMIT_LIFECYCLE="$lifecycle" CHECKPOINT_COMMIT_REPORT_DIR="$PWD/$report/$browser-$mode-$lifecycle" node packages/portal/scripts/verify-checkpoint-commit-browser.mjs > "$report/$browser-$mode-$lifecycle.log" 2>&1
  done
 done
done
