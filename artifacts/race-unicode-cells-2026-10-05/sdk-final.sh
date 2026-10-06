#!/usr/bin/env bash
set -euo pipefail
export pnpm_config_verify_deps_before_run=false NODE_OPTIONS=--experimental-vm-modules SINGLE_PLAYER_REPAIR_TRACE=1 SINGLE_PLAYER_PROJECTION_TRACE=1
report="/home/craig-beswetherick/Documents/riddle-quest/artifacts/race-unicode-cells-2026-10-05"
pnpm exec jest --config "$report/integration.config.cjs" --runInBand > "$report/live-integrations.log" 2>&1
printf 'full SDK integrations passed\n'
node scripts/run-with-functions-node.js ../artifacts/race-unicode-cells-2026-10-05/node22-sdk.cjs > "$report/node22-sdk.log" 2>&1
printf 'pinned Node22 Unicode SDK passed\n'
