#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false
python3 artifacts/live-destination-capability-2026-10-06/run-job.py navigation-development navigation-development.log env RACE_NAV_REACT_MODE=development RACE_NAV_REPORT_DIR=../../artifacts/live-destination-capability-2026-10-06/navigation-development pnpm --dir packages/portal exec node scripts/verify-race-navigation-focus-browser.mjs
python3 artifacts/live-destination-capability-2026-10-06/run-job.py navigation-production navigation-production.log env RACE_NAV_REACT_MODE=production RACE_NAV_REPORT_DIR=../../artifacts/live-destination-capability-2026-10-06/navigation-production pnpm --dir packages/portal exec node scripts/verify-race-navigation-focus-browser.mjs
