#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
python3 artifacts/live-tournament-owner-2026-10-06/run-job.py chromium-development chromium-development.log env LIVE_TOURNAMENT_MODE=development LIVE_TOURNAMENT_BROWSER=chromium LIVE_TOURNAMENT_REPORT_DIR=../../artifacts/live-tournament-owner-2026-10-06/chromium-development pnpm --dir packages/portal exec node scripts/verify-live-tournament-owner-browser.mjs
python3 artifacts/live-tournament-owner-2026-10-06/run-job.py chromium-production chromium-production.log env LIVE_TOURNAMENT_MODE=production LIVE_TOURNAMENT_BROWSER=chromium LIVE_TOURNAMENT_REPORT_DIR=../../artifacts/live-tournament-owner-2026-10-06/chromium-production pnpm --dir packages/portal exec node scripts/verify-live-tournament-owner-browser.mjs
