#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
engine="$1"
report=artifacts/pending-play-lifetime-2026-10-06
export PENDING_LIFE_BROWSER="$engine" PENDING_SCOPE_BROWSER="$engine"
export PENDING_LIFE_FIREFOX_EXECUTABLE=/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox
export PENDING_SCOPE_FIREFOX_EXECUTABLE="$PENDING_LIFE_FIREFOX_EXECUTABLE"
for mode in development production; do
 export PENDING_LIFE_MODE="$mode" PENDING_SCOPE_MODE="$mode"
 PENDING_LIFE_REPORT_DIR="../../$report/$engine-$mode" pnpm --dir packages/portal exec node scripts/verify-pending-play-lifetime-browser.mjs > "$report/$engine-$mode.log" 2>&1
 PENDING_SCOPE_REPORT_DIR="../../$report/scope-$engine-$mode" pnpm --dir packages/portal exec node scripts/verify-pending-play-scope-retirement-browser.mjs > "$report/scope-$engine-$mode.log" 2>&1
 PENDING_SCOPE_REPORT_DIR="$report/early-$engine-$mode" node artifacts/pending-play-scope-retirement-2026-10-06/verify-early-skip.mjs > "$report/early-$engine-$mode.log" 2>&1
 done
