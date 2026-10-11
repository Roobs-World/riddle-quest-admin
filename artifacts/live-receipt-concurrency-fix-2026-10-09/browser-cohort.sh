#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
export LIVE_DRAFT_REACT_MODE="$1" LIVE_RELOAD_BROWSER="$2"
export LIVE_RELOAD_FIREFOX_EXECUTABLE=/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox
report=artifacts/live-receipt-concurrency-fix-2026-10-09
node "$report/reload-probe.mjs" > "$report/$2-$1-final.log" 2>&1
for probe in reload boundary writer storage poll; do
 node "$report/compatibility-$probe-probe.mjs" > "$report/$2-$1-compatibility-$probe.log" 2>&1
done
