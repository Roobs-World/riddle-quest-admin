#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
for mode in development production; do
 env LIVE_WAIT_REACT_MODE="$mode" LIVE_WAIT_REPORT_DIR="../../artifacts/live-confirmation-retirement-2026-10-04/regression-live-wait-retirement/$mode" pnpm --dir packages/portal exec node scripts/verify-live-wait-retirement-browser.mjs > "artifacts/live-confirmation-retirement-2026-10-04/regression-live-wait-retirement-$mode.log" 2>&1
done
for mode in development production; do
 env LIVE_PROVIDER_REACT_MODE="$mode" LIVE_PROVIDER_REPORT_DIR="../../artifacts/live-confirmation-retirement-2026-10-04/regression-live-provider-retirement/$mode" pnpm --dir packages/portal exec node scripts/verify-live-provider-retirement-browser.mjs > "artifacts/live-confirmation-retirement-2026-10-04/regression-live-provider-retirement-$mode.log" 2>&1
done
for mode in development production; do
 env LIVE_CALLBACK_REACT_MODE="$mode" LIVE_CALLBACK_REPORT_DIR="../../artifacts/live-confirmation-retirement-2026-10-04/regression-live-callback-lifetime/$mode" pnpm --dir packages/portal exec node scripts/verify-live-callback-lifetime-browser.mjs > "artifacts/live-confirmation-retirement-2026-10-04/regression-live-callback-lifetime-$mode.log" 2>&1
done
