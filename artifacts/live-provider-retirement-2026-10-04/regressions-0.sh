#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
for mode in development production; do
 env LIVE_DRAFT_REACT_MODE="$mode" LIVE_DRAFT_REPORT_DIR="../../artifacts/live-provider-retirement-2026-10-04/regression-live-reconnect-input/$mode" pnpm --dir packages/portal exec node scripts/verify-live-reconnect-input-browser.mjs > "artifacts/live-provider-retirement-2026-10-04/regression-live-reconnect-input-$mode.log" 2>&1
done
printf 'live-reconnect-input passed\n'
for mode in development production; do
 env LIVE_IMMEDIATE_REACT_MODE="$mode" LIVE_IMMEDIATE_REPORT_DIR="../../artifacts/live-provider-retirement-2026-10-04/regression-live-immediate-submit/$mode" pnpm --dir packages/portal exec node scripts/verify-live-immediate-submit-browser.mjs > "artifacts/live-provider-retirement-2026-10-04/regression-live-immediate-submit-$mode.log" 2>&1
done
printf 'live-immediate-submit passed\n'
