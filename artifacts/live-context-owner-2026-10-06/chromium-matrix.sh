#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
python3 artifacts/live-context-owner-2026-10-06/run-job.py chromium-development chromium-development.log env LIVE_CONTEXT_MODE=development LIVE_CONTEXT_BROWSER=chromium LIVE_CONTEXT_REPORT_DIR=../../artifacts/live-context-owner-2026-10-06/chromium-development pnpm --dir packages/portal exec node scripts/verify-live-context-owner-browser.mjs
python3 artifacts/live-context-owner-2026-10-06/run-job.py chromium-production chromium-production.log env LIVE_CONTEXT_MODE=production LIVE_CONTEXT_BROWSER=chromium LIVE_CONTEXT_REPORT_DIR=../../artifacts/live-context-owner-2026-10-06/chromium-production pnpm --dir packages/portal exec node scripts/verify-live-context-owner-browser.mjs
