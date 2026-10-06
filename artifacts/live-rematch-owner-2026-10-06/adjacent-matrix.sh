#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
python3 artifacts/live-rematch-owner-2026-10-06/run-job.py history-development history-development.log env LIVE_HISTORY_MODE=development LIVE_HISTORY_REPORT_DIR=../../artifacts/live-rematch-owner-2026-10-06/history-development pnpm --dir packages/portal exec node scripts/verify-live-history-provider-browser.mjs
python3 artifacts/live-rematch-owner-2026-10-06/run-job.py history-production history-production.log env LIVE_HISTORY_MODE=production LIVE_HISTORY_REPORT_DIR=../../artifacts/live-rematch-owner-2026-10-06/history-production pnpm --dir packages/portal exec node scripts/verify-live-history-provider-browser.mjs
python3 artifacts/live-rematch-owner-2026-10-06/run-job.py destinations-development destinations-development.log env LIVE_DEST_MODE=development LIVE_DEST_REPORT_DIR=../../artifacts/live-rematch-owner-2026-10-06/destinations-development pnpm --dir packages/portal exec node scripts/verify-live-destination-capability-browser.mjs
python3 artifacts/live-rematch-owner-2026-10-06/run-job.py destinations-production destinations-production.log env LIVE_DEST_MODE=production LIVE_DEST_REPORT_DIR=../../artifacts/live-rematch-owner-2026-10-06/destinations-production pnpm --dir packages/portal exec node scripts/verify-live-destination-capability-browser.mjs
