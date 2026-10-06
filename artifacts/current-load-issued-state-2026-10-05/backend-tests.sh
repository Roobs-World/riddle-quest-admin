#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false NODE_OPTIONS=--experimental-vm-modules SINGLE_PLAYER_REPAIR_TRACE=1 SINGLE_PLAYER_PROJECTION_TRACE=1
report="/home/craig-beswetherick/Documents/riddle-quest/artifacts/current-load-issued-state-2026-10-05"
pnpm exec jest --config jest.config.js --runInBand > "$report/backend-units.log" 2>&1
printf 'backend units passed\n'
pnpm exec jest --config "$report/integration.config.cjs" --runInBand > "$report/live-integrations.log" 2>&1
printf 'live emulator integrations passed\n'
