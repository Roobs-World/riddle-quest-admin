#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
python3 artifacts/live-rematch-owner-2026-10-06/run-job.py firefox-development firefox-development.log env LIVE_REMATCH_MODE=development LIVE_REMATCH_BROWSER=firefox LIVE_REMATCH_REPORT_DIR=../../artifacts/live-rematch-owner-2026-10-06/firefox-development LIVE_REMATCH_FIREFOX_EXECUTABLE=/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox pnpm --dir packages/portal exec node scripts/verify-live-rematch-owner-browser.mjs
python3 artifacts/live-rematch-owner-2026-10-06/run-job.py firefox-production firefox-production.log env LIVE_REMATCH_MODE=production LIVE_REMATCH_BROWSER=firefox LIVE_REMATCH_REPORT_DIR=../../artifacts/live-rematch-owner-2026-10-06/firefox-production LIVE_REMATCH_FIREFOX_EXECUTABLE=/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox pnpm --dir packages/portal exec node scripts/verify-live-rematch-owner-browser.mjs
