#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
engine="$1"
report=artifacts/live-history-provider-2026-10-06
export LIVE_HISTORY_BROWSER="$engine" LIVE_HISTORY_FIREFOX_EXECUTABLE=/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox
for mode in development production; do
 export LIVE_HISTORY_MODE="$mode"
 LIVE_HISTORY_REPORT_DIR="../../$report/$engine-$mode" pnpm --dir packages/portal exec node scripts/verify-live-history-provider-browser.mjs > "$report/$engine-$mode.log" 2>&1
 done
