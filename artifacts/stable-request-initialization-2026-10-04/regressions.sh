#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
report=artifacts/stable-request-initialization-2026-10-04
for mode in development production; do
 env LIVE_DRAFT_REACT_MODE="$mode" LIVE_DRAFT_REPORT_DIR="$report/regression-live-reconnect/$mode" node packages/portal/scripts/verify-live-reconnect-input-browser.mjs > "$report/regression-live-reconnect-$mode.log" 2>&1
 env STATIC_KEYBOARD_REACT_MODE="$mode" STATIC_KEYBOARD_REPORT_DIR="$report/regression-static-keyboard/$mode" node packages/portal/scripts/verify-static-keyboard-work-browser.mjs > "$report/regression-static-keyboard-$mode.log" 2>&1
 env LIVE_CALLBACK_REACT_MODE="$mode" LIVE_CALLBACK_REPORT_DIR="$report/regression-live-callback/$mode" node packages/portal/scripts/verify-live-callback-lifetime-browser.mjs > "$report/regression-live-callback-$mode.log" 2>&1
done
printf 'Regression browser gates passed\n'
