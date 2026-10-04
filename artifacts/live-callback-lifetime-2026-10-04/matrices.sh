#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
LIVE_CALLBACK_REACT_MODE=development LIVE_CALLBACK_REPORT_DIR=artifacts/live-callback-lifetime-2026-10-04/final-development node packages/portal/scripts/verify-live-callback-lifetime-browser.mjs > artifacts/live-callback-lifetime-2026-10-04/final-development.log 2>&1
LIVE_CALLBACK_REACT_MODE=production LIVE_CALLBACK_REPORT_DIR=artifacts/live-callback-lifetime-2026-10-04/final-production node packages/portal/scripts/verify-live-callback-lifetime-browser.mjs > artifacts/live-callback-lifetime-2026-10-04/final-production.log 2>&1
LIVE_CALLBACK_REACT_MODE=production LIVE_CALLBACK_BASELINE_DIR=artifacts/live-callback-lifetime-2026-10-04 LIVE_CALLBACK_MEASURE_ONLY=1 LIVE_CALLBACK_REPORT_DIR=artifacts/live-callback-lifetime-2026-10-04/original-verified node packages/portal/scripts/verify-live-callback-lifetime-browser.mjs > artifacts/live-callback-lifetime-2026-10-04/original-verified.log 2>&1
printf 'Callback lifetime matrices passed\n'
