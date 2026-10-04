#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
LIVE_WAIT_REACT_MODE=development LIVE_WAIT_REPORT_DIR=artifacts/live-wait-retirement-2026-10-04/final-development node packages/portal/scripts/verify-live-wait-retirement-browser.mjs > artifacts/live-wait-retirement-2026-10-04/final-development.log 2>&1
LIVE_WAIT_REACT_MODE=production LIVE_WAIT_REPORT_DIR=artifacts/live-wait-retirement-2026-10-04/final-production node packages/portal/scripts/verify-live-wait-retirement-browser.mjs > artifacts/live-wait-retirement-2026-10-04/final-production.log 2>&1
LIVE_WAIT_REACT_MODE=production LIVE_WAIT_BASELINE_DIR=artifacts/live-wait-retirement-2026-10-04 LIVE_WAIT_MEASURE_ONLY=1 LIVE_WAIT_REPORT_DIR=artifacts/live-wait-retirement-2026-10-04/original-verified node packages/portal/scripts/verify-live-wait-retirement-browser.mjs > artifacts/live-wait-retirement-2026-10-04/original-verified.log 2>&1
