#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
report=artifacts/live-render-work-2026-10-04
for mode in development production; do
 env LIVE_CLOCK_REACT_MODE="$mode" LIVE_CLOCK_REPORT_DIR="$report/regression-clock-visibility/$mode" node packages/portal/scripts/verify-live-clock-visibility-browser.mjs > "$report/regression-clock-visibility-$mode.log" 2>&1
 env STABLE_REQUEST_REACT_MODE="$mode" STABLE_REQUEST_REPORT_DIR="$report/regression-mounted-ids/$mode" node packages/portal/scripts/verify-stable-request-initialization-browser.mjs > "$report/regression-mounted-ids-$mode.log" 2>&1
 env LIVE_DRAFT_REACT_MODE="$mode" LIVE_DRAFT_REPORT_DIR="$report/regression-live-reconnect/$mode" node packages/portal/scripts/verify-live-reconnect-input-browser.mjs > "$report/regression-live-reconnect-$mode.log" 2>&1
done
control=packages/portal/scripts/.live-render-stale-clock-control.mjs
trap 'rm -f "$control"' EXIT
cp "$report/stale-clock-control.source.txt" "$control"
node "$control" > "$report/regression-stale-clock.log" 2>&1
printf 'Render regression gates passed\n'
