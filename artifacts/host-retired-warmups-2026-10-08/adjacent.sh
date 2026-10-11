#!/usr/bin/env bash
set -euo pipefail
HOST_COMMIT_QUICK=1 HOST_COMMIT_REACT_MODE=development HOST_COMMIT_REPORT_DIR="/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-retired-warmups-2026-10-08/commit-development" node packages/portal/scripts/verify-host-riddle-commit-retirement-browser.mjs > "/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-retired-warmups-2026-10-08/commit-development.log" 2>&1
echo "commit-development passed"
RIDDLE_RECOVERY_QUICK=1 RIDDLE_RECOVERY_REACT_MODE=development RIDDLE_RECOVERY_REPORT_DIR="/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-retired-warmups-2026-10-08/coalescing-development" node packages/portal/scripts/verify-riddle-recovery-coalescing-browser.mjs > "/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-retired-warmups-2026-10-08/coalescing-development.log" 2>&1
echo "coalescing-development passed"
HOST_COMMIT_QUICK=1 HOST_COMMIT_REACT_MODE=production HOST_COMMIT_REPORT_DIR="/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-retired-warmups-2026-10-08/commit-production" node packages/portal/scripts/verify-host-riddle-commit-retirement-browser.mjs > "/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-retired-warmups-2026-10-08/commit-production.log" 2>&1
echo "commit-production passed"
RIDDLE_RECOVERY_QUICK=1 RIDDLE_RECOVERY_REACT_MODE=production RIDDLE_RECOVERY_REPORT_DIR="/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-retired-warmups-2026-10-08/coalescing-production" node packages/portal/scripts/verify-riddle-recovery-coalescing-browser.mjs > "/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-retired-warmups-2026-10-08/coalescing-production.log" 2>&1
echo "coalescing-production passed"
RECOVERY_SUSPENSION_MODE=development RECOVERY_SUSPENSION_REPORT_DIR="/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-retired-warmups-2026-10-08/suspension-development" node packages/portal/scripts/verify-host-recovery-suspension-browser.mjs > "/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-retired-warmups-2026-10-08/suspension-development.log" 2>&1
echo "suspension-development passed"
RECOVERY_SUSPENSION_MODE=production RECOVERY_SUSPENSION_REPORT_DIR="/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-retired-warmups-2026-10-08/suspension-production" node packages/portal/scripts/verify-host-recovery-suspension-browser.mjs > "/home/craig-beswetherick/Documents/riddle-quest/artifacts/host-retired-warmups-2026-10-08/suspension-production.log" 2>&1
echo "suspension-production passed"
