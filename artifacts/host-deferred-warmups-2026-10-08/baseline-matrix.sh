#!/usr/bin/env bash
set -uo pipefail
DEFERRED_WARMUPS_BASELINE_FILE="/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-deferred-warmups-2026-10-08/services-before.txt" DEFERRED_WARMUPS_QUICK=1 DEFERRED_WARMUPS_MODE=development DEFERRED_WARMUPS_REPORT_DIR="/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-deferred-warmups-2026-10-08/baseline-development" node "artifacts/host-deferred-warmups-2026-10-08/baseline-probe.mjs" > "artifacts/host-deferred-warmups-2026-10-08/baseline-development.log" 2>&1
code=$?; echo "baseline-development $code"; test "$code" -eq 1 || exit 2
DEFERRED_WARMUPS_BASELINE_FILE="/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-deferred-warmups-2026-10-08/services-before.txt" DEFERRED_WARMUPS_QUICK=1 DEFERRED_WARMUPS_MODE=production DEFERRED_WARMUPS_REPORT_DIR="/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-deferred-warmups-2026-10-08/baseline-production" node "artifacts/host-deferred-warmups-2026-10-08/baseline-probe.mjs" > "artifacts/host-deferred-warmups-2026-10-08/baseline-production.log" 2>&1
code=$?; echo "baseline-production $code"; test "$code" -eq 1 || exit 2
