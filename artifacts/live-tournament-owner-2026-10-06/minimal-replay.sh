#!/usr/bin/env bash
set -euo pipefail
set +e
python3 artifacts/live-tournament-owner-2026-10-06/run-job.py minimal-final-baseline-development minimal-final-baseline-development.log env LIVE_TOURNAMENT_MODE=development LIVE_TOURNAMENT_REPORT_DIR=artifacts/live-tournament-owner-2026-10-06/minimal-final-baseline-development LIVE_TOURNAMENT_BASELINE_FILE=artifacts/live-tournament-owner-2026-10-06/owned-00-before.txt node artifacts/live-tournament-owner-2026-10-06/probe-minimal.mjs
task_probe_status=$?
set -e
test "$task_probe_status" -eq 1
python3 artifacts/live-tournament-owner-2026-10-06/run-job.py minimal-final-green-development minimal-final-green-development.log env LIVE_TOURNAMENT_MODE=development LIVE_TOURNAMENT_REPORT_DIR=artifacts/live-tournament-owner-2026-10-06/minimal-final-green-development node artifacts/live-tournament-owner-2026-10-06/probe-minimal.mjs
set +e
python3 artifacts/live-tournament-owner-2026-10-06/run-job.py minimal-final-baseline-production minimal-final-baseline-production.log env LIVE_TOURNAMENT_MODE=production LIVE_TOURNAMENT_REPORT_DIR=artifacts/live-tournament-owner-2026-10-06/minimal-final-baseline-production LIVE_TOURNAMENT_BASELINE_FILE=artifacts/live-tournament-owner-2026-10-06/owned-00-before.txt node artifacts/live-tournament-owner-2026-10-06/probe-minimal.mjs
task_probe_status=$?
set -e
test "$task_probe_status" -eq 1
python3 artifacts/live-tournament-owner-2026-10-06/run-job.py minimal-final-green-production minimal-final-green-production.log env LIVE_TOURNAMENT_MODE=production LIVE_TOURNAMENT_REPORT_DIR=artifacts/live-tournament-owner-2026-10-06/minimal-final-green-production node artifacts/live-tournament-owner-2026-10-06/probe-minimal.mjs
