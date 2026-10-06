#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
python3 artifacts/live-context-owner-2026-10-06/run-job.py firefox-development firefox-development.log env LIVE_CONTEXT_MODE=development LIVE_CONTEXT_BROWSER=firefox LIVE_CONTEXT_REPORT_DIR=../../artifacts/live-context-owner-2026-10-06/firefox-development LIVE_CONTEXT_FIREFOX_EXECUTABLE=/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox pnpm --dir packages/portal exec node scripts/verify-live-context-owner-browser.mjs
python3 artifacts/live-context-owner-2026-10-06/run-job.py firefox-production firefox-production.log env LIVE_CONTEXT_MODE=production LIVE_CONTEXT_BROWSER=firefox LIVE_CONTEXT_REPORT_DIR=../../artifacts/live-context-owner-2026-10-06/firefox-production LIVE_CONTEXT_FIREFOX_EXECUTABLE=/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox pnpm --dir packages/portal exec node scripts/verify-live-context-owner-browser.mjs
