#!/usr/bin/env bash
set -euo pipefail
report=artifacts/centered-tooltip-work-2026-10-05
for mode in development production; do
 GUIDANCE_RECOVERY_REACT_MODE="$mode" GUIDANCE_RECOVERY_REPORT_DIR="$report/guidance-recovery-$mode" node packages/portal/scripts/verify-guidance-storage-recovery-browser.mjs > "$report/guidance-recovery-$mode.log" 2>&1
 printf '%s guidance recovery passed\n' "$mode"
done
